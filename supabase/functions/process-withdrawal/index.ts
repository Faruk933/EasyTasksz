import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_INIT_MAX_AGE_SECONDS = 300;
const TELEGRAM_FUTURE_SKEW_SECONDS = 30;
const OXAPAY_TIMEOUT_MS = 20000;

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
  const secretKey = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secretKeySigned = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  const finalKey = await crypto.subtle.importKey("raw", secretKeySigned, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", finalKey, encoder.encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!timingSafeEqualHex(computedHash, hash)) return null;

  const userStr = params.get("user");
  if (!userStr) return null;
  try { return JSON.parse(userStr); } catch { return null; }
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
    const OXAPAY_KEY = Deno.env.get("OXAPAY_PAYOUT_API_KEY")!;
    const { initData, withdrawalId, status, adminNote } = await req.json();

    if (!initData || withdrawalId === undefined || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    const tgUser = await verifyTelegramData(String(initData), BOT_TOKEN);
    if (!tgUser || !tgUser.id) {
      return new Response(JSON.stringify({ error: "Invalid or expired Telegram data" }), { status: 401, headers: corsHeaders });
    }

    if (String(tgUser.id) !== "1115177381") {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: corsHeaders });
    }

    const id = Number(withdrawalId);
    if (!Number.isSafeInteger(id) || id <= 0 || !["approved", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid withdrawal request" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const action = status === "approved" ? "approve" : "reject";

    // Atomically claim the withdrawal. A second approval cannot reach OxaPay.
    let { data: transition, error: transitionError } = await supabase.rpc("transition_withdrawal", {
      p_withdrawal_id: id,
      p_action: action,
    });

    if (transitionError) {
      const message = transitionError.message || "";
      if (message.includes("not found")) return new Response(JSON.stringify({ error: "Withdrawal not found" }), { status: 404, headers: corsHeaders });
      if (message.includes("already being processed")) return new Response(JSON.stringify({ error: "Withdrawal is already being processed or completed" }), { status: 409, headers: corsHeaders });
      throw transitionError;
    }

    if (status === "rejected") {
      const { error: noteError } = await supabase.from("withdrawals").update({ admin_note: adminNote ?? null }).eq("id", id).eq("status", "rejected");
      if (noteError) throw noteError;
      return new Response(JSON.stringify({ success: true, refunded: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const withdrawal = transition;
    const payoutAmountSol = Number(withdrawal?.payout_amount);
    if (!Number.isFinite(payoutAmountSol) || payoutAmountSol <= 0) {
      await supabase.from("withdrawals").update({ payout_status: "failed", payout_error: "Invalid SOL payout amount" }).eq("id", id).eq("status", "pending");
      return new Response(JSON.stringify({ error: "Invalid SOL payout amount" }), { status: 400, headers: corsHeaders });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OXAPAY_TIMEOUT_MS);
    let oxapayResponse: Response;
    try {
      oxapayResponse = await fetch("https://api.oxapay.com/v1/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "payout_api_key": OXAPAY_KEY },
        body: JSON.stringify({
          address: withdrawal.wallet_address,
          currency: "SOL",
          amount: payoutAmountSol,
          network: "Solana",
          description: `Withdrawal #${id}`,
        }),
        signal: controller.signal,
      });
    } catch {
      // Keep payout_status=processing. The provider may have accepted the request,
      // so automatically retrying could create a second payout.
      return new Response(JSON.stringify({ error: "OxaPay payout status is uncertain; withdrawal locked for reconciliation" }), { status: 504, headers: corsHeaders });
    } finally {
      clearTimeout(timeout);
    }

    let oxapayResult: any = null;
    try { oxapayResult = await oxapayResponse.json(); } catch { oxapayResult = {}; }

    if (!oxapayResponse.ok || oxapayResult.error) {
      const errorMsg = oxapayResult.error?.message || oxapayResult.message || "Payout failed";
      await supabase.from("withdrawals").update({ payout_status: "failed", payout_error: errorMsg }).eq("id", id).eq("status", "pending");
      return new Response(JSON.stringify({ error: "OxaPay payout failed: " + errorMsg }), { status: 400, headers: corsHeaders });
    }

    const trackId = oxapayResult.data?.track_id ?? null;
    const payoutStatus = oxapayResult.data?.status ?? "processing";
    const { error: updateError } = await supabase.from("withdrawals").update({
      status: "approved",
      processed_at: new Date().toISOString(),
      admin_note: adminNote ?? null,
      oxapay_track_id: trackId,
      payout_status: payoutStatus,
      payout_error: null,
    }).eq("id", id).eq("status", "pending").eq("payout_status", "processing");

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, trackId, payoutStatus, currency: "SOL", network: "Solana", amount: payoutAmountSol }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ error: "Withdrawal processing failed" }), { status: 500, headers: corsHeaders });
  }
});
