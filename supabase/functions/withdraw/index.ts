import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_INIT_MAX_AGE_SECONDS = 300;
const TELEGRAM_FUTURE_SKEW_SECONDS = 30;
const SOL_NETWORK_FEE = 0.00005;
const SOL_MIN_TRANSFER = 0.001;

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyTelegramData(initData: string, botToken: string): Promise<any | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !Number.isInteger(authDate)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + TELEGRAM_FUTURE_SKEW_SECONDS || now - authDate > TELEGRAM_INIT_MAX_AGE_SECONDS) return null;

  params.delete("hash");
  const pairs: string[] = [];
  params.forEach((value, key) => pairs.push(`${key}=${value}`));
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const secretKeySigned = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  const finalKey = await crypto.subtle.importKey(
    "raw", secretKeySigned, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", finalKey, encoder.encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (!timingSafeEqualHex(computedHash, hash)) return null;

  const userStr = params.get("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

async function getSolUsdPrice(): Promise<number> {
  const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT");
  if (!response.ok) throw new Error("Unable to fetch current SOL price");
  const data = await response.json();
  const price = Number(data?.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid SOL price");
  return price;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const { initData, walletAddress, amount } = await req.json();

    if (!initData || !walletAddress || amount === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    const wallet = String(walletAddress).trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      return new Response(JSON.stringify({ error: "Invalid Solana wallet address" }), { status: 400, headers: corsHeaders });
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid withdrawal amount" }), { status: 400, headers: corsHeaders });
    }

    const tgUser = await verifyTelegramData(String(initData), BOT_TOKEN);
    if (!tgUser || !tgUser.id) {
      return new Response(JSON.stringify({ error: "Invalid or expired Telegram data" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: settingsRows, error: settingsError } = await supabase.from("settings").select("key, value");
    if (settingsError) throw settingsError;

    const settingsMap: Record<string, any> = {};
    (settingsRows || []).forEach((r) => { settingsMap[r.key] = r.value; });
    const minWithdrawal = Number(settingsMap.minimum_withdrawal ?? 10);
    const feePercent = Number(settingsMap.withdrawal_fee_percent ?? 0);

    if (!Number.isFinite(minWithdrawal) || minWithdrawal <= 0) {
      return new Response(JSON.stringify({ error: "Withdrawal settings are invalid" }), { status: 500, headers: corsHeaders });
    }

    if (numAmount < minWithdrawal) {
      return new Response(JSON.stringify({ error: "Minimum withdrawal is $" + minWithdrawal }), { status: 400, headers: corsHeaders });
    }

    const feeAmountUsd = numAmount * (feePercent / 100);
    const payoutBeforeNetworkFeeUsd = numAmount - feeAmountUsd;
    if (!Number.isFinite(feeAmountUsd) || feeAmountUsd < 0 || !Number.isFinite(payoutBeforeNetworkFeeUsd) || payoutBeforeNetworkFeeUsd <= 0) {
      return new Response(JSON.stringify({ error: "Invalid withdrawal calculation" }), { status: 400, headers: corsHeaders });
    }

    const solPriceUsd = await getSolUsdPrice();
    const grossPayoutSol = payoutBeforeNetworkFeeUsd / solPriceUsd;
    const payoutSol = Number((grossPayoutSol - SOL_NETWORK_FEE).toFixed(8));

    if (!Number.isFinite(payoutSol) || payoutSol < SOL_MIN_TRANSFER) {
      return new Response(JSON.stringify({ error: `Withdrawal is below OxaPay's minimum SOL transfer of ${SOL_MIN_TRANSFER} SOL` }), { status: 400, headers: corsHeaders });
    }

    // The database function locks the user's row before checking and reserving balance.
    // This prevents concurrent withdrawal requests from spending the same balance twice.
    const { data: result, error: withdrawalError } = await supabase.rpc("create_withdrawal_atomic", {
      p_telegram_id: Number(tgUser.id),
      p_wallet_address: wallet,
      p_amount: numAmount,
      p_fee_amount: feeAmountUsd,
      p_payout_amount: payoutSol,
    });

    if (withdrawalError) {
      const message = withdrawalError.message || "";
      if (message.includes("Insufficient balance")) {
        return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400, headers: corsHeaders });
      }
      if (message.includes("Account is banned")) {
        return new Response(JSON.stringify({ error: "Account is banned" }), { status: 403, headers: corsHeaders });
      }
      if (message.includes("User not found")) {
        return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
      }
      throw withdrawalError;
    }

    return new Response(JSON.stringify({
      withdrawal: result?.withdrawal,
      newBalance: result?.new_balance,
      currency: "SOL",
      network: "Solana",
      solPriceUsd,
      networkFeeSol: SOL_NETWORK_FEE,
      payoutSol,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Withdrawal request failed" }), { status: 500, headers: corsHeaders });
  }
});
