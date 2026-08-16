import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOL_NETWORK_FEE = 0.00005;
const SOL_MIN_TRANSFER = 0.001;

async function verifyTelegramData(initData: string, botToken: string): Promise<any | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
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

  if (computedHash !== hash) return null;
  const userStr = params.get("user");
  if (!userStr) return null;
  return JSON.parse(userStr);
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

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const { initData, walletAddress, amount } = await req.json();

    if (!initData || !walletAddress || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    // Native Solana addresses are base58 and normally 32-44 characters long.
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(walletAddress).trim())) {
      return new Response(JSON.stringify({ error: "Invalid Solana wallet address" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: settingsRows } = await supabase.from("settings").select("key, value");
    const settingsMap: Record<string, any> = {};
    (settingsRows || []).forEach((r) => { settingsMap[r.key] = r.value; });
    const minWithdrawal = Number(settingsMap.minimum_withdrawal ?? 10);
    const feePercent = Number(settingsMap.withdrawal_fee_percent ?? 0);

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < minWithdrawal) {
      return new Response(JSON.stringify({ error: "Minimum withdrawal is $" + minWithdrawal }), { status: 400, headers: corsHeaders });
    }

    const tgUser = await verifyTelegramData(initData, BOT_TOKEN);
    if (!tgUser) return new Response(JSON.stringify({ error: "Invalid Telegram data" }), { status: 401, headers: corsHeaders });

    const { data: user, error: fetchError } = await supabase
      .from("users").select("*").eq("telegram_id", tgUser.id).single();
    if (fetchError || !user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });

    if (Number(user.balance) < numAmount) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400, headers: corsHeaders });
    }

    const feeAmountUsd = numAmount * (feePercent / 100);
    const payoutBeforeNetworkFeeUsd = numAmount - feeAmountUsd;
    const solPriceUsd = await getSolUsdPrice();
    const grossPayoutSol = payoutBeforeNetworkFeeUsd / solPriceUsd;
    const payoutSol = Number((grossPayoutSol - SOL_NETWORK_FEE).toFixed(8));

    if (!Number.isFinite(payoutSol) || payoutSol < SOL_MIN_TRANSFER) {
      return new Response(JSON.stringify({ error: `Withdrawal is below OxaPay's minimum SOL transfer of ${SOL_MIN_TRANSFER} SOL` }), { status: 400, headers: corsHeaders });
    }

    const newBalance = Number(user.balance) - numAmount;
    const { error: updateError } = await supabase.from("users").update({ balance: newBalance }).eq("telegram_id", tgUser.id);
    if (updateError) throw updateError;

    const { data: withdrawal, error: insertError } = await supabase
      .from("withdrawals")
      .insert({
        user_id: user.id,
        wallet_address: String(walletAddress).trim(),
        amount: numAmount,
        fee_amount: feeAmountUsd,
        payout_amount: payoutSol,
        status: "pending",
      })
      .select().single();
    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      withdrawal,
      newBalance,
      currency: "SOL",
      network: "Solana",
      solPriceUsd,
      networkFeeSol: SOL_NETWORK_FEE,
      payoutSol,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
