import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  const secretKey = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secretKeySigned = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  const finalKey = await crypto.subtle.importKey("raw", secretKeySigned, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", finalKey, encoder.encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (computedHash !== hash) return null;
  const userStr = params.get("user");
  if (!userStr) return null;
  return JSON.parse(userStr);
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const OXAPAY_KEY = Deno.env.get("OXAPAY_PAYOUT_API_KEY")!;
    const { initData, withdrawalId, status, adminNote } = await req.json();
    if (!initData || !withdrawalId || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    const tgUser = await verifyTelegramData(initData, BOT_TOKEN);
    if (!tgUser) return new Response(JSON.stringify({ error: "Invalid Telegram data" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: adminCheck, error: adminError } = await supabase.from("users").select("is_admin").eq("telegram_id", tgUser.id).single();
    if (adminError || !adminCheck || !adminCheck.is_admin) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: corsHeaders });
    }

    const { data: withdrawal, error: fetchError } = await supabase.from("withdrawals").select("*").eq("id", withdrawalId).single();
    if (fetchError || !withdrawal) return new Response(JSON.stringify({ error: "Withdrawal not found" }), { status: 404, headers: corsHeaders });

    if (status === "rejected") {
      const { error: updateError } = await supabase.from("withdrawals").update({ status: "rejected", processed_at: new Date().toISOString(), admin_note: adminNote ?? null }).eq("id", withdrawalId);
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (status === "approved") {
      // payout_amount is stored in SOL by the withdraw function.
      const payoutAmountSol = Number(withdrawal.payout_amount);
      if (!Number.isFinite(payoutAmountSol) || payoutAmountSol <= 0) {
        return new Response(JSON.stringify({ error: "Invalid SOL payout amount" }), { status: 400, headers: corsHeaders });
      }

      const oxapayResponse = await fetch("https://api.oxapay.com/v1/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "payout_api_key": OXAPAY_KEY },
        body: JSON.stringify({
          address: withdrawal.wallet_address,
          currency: "SOL",
          amount: payoutAmountSol,
          network: "Solana",
          description: `Withdrawal #${withdrawal.id}`,
        }),
      });

      const oxapayResult = await oxapayResponse.json();
      if (!oxapayResponse.ok || oxapayResult.error) {
        const errorMsg = oxapayResult.error?.message || oxapayResult.message || "Payout failed";
        await supabase.from("withdrawals").update({ payout_status: "failed", payout_error: errorMsg }).eq("id", withdrawalId);
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
      }).eq("id", withdrawalId);
      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, trackId, payoutStatus, currency: "SOL", network: "Solana", amount: payoutAmountSol }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
