import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userID") ?? url.searchParams.get("userId");
    const transactionId = url.searchParams.get("transactionID") ?? url.searchParams.get("transactionId");
    const currencyAmount = Number(url.searchParams.get("currencyAmount") ?? "0");
    const revenue = Number(url.searchParams.get("revenue") ?? "0");
    const type = url.searchParams.get("type") ?? "credit";
    const offerName = url.searchParams.get("offername") ?? "TimeWall offer";
    const hash = url.searchParams.get("hash") ?? "";

    if (!userId || !transactionId || !Number.isFinite(currencyAmount) || currencyAmount <= 0) {
      return new Response(JSON.stringify({ error: "Missing or invalid postback parameters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const secret = Deno.env.get("TIMEWALL_SECRET_KEY");
    if (!secret) throw new Error("TIMEWALL_SECRET_KEY is not configured");

    const encoder = new TextEncoder();
    const data = encoder.encode(`${userId}${revenue}${secret}`);
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, data);
    const expectedHash = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hash && hash !== expectedHash) return new Response(JSON.stringify({ error: "Invalid hash" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: existing } = await supabase.from("offerwall_transactions").select("id").eq("click_id", `timewall:${transactionId}`).maybeSingle();
    if (existing) return new Response(JSON.stringify({ success: true, duplicate: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (type !== "credit") {
      return new Response(JSON.stringify({ success: true, processed: false, type }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const telegramId = Number(userId);
    const { data: user } = await supabase.from("users").select("id,balance,total_earned").eq("telegram_id", telegramId).maybeSingle();
    if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const amount = Number(currencyAmount.toFixed(8));
    const { error: txError } = await supabase.from("offerwall_transactions").insert({ click_id: `timewall:${transactionId}`, user_id: user.id, payout_usd: revenue, user_share: amount });
    if (txError) throw txError;

    const { error: userError } = await supabase.from("users").update({ balance: Number(user.balance ?? 0) + amount, total_earned: Number(user.total_earned ?? 0) + amount }).eq("id", user.id);
    if (userError) throw userError;

    return new Response(JSON.stringify({ success: true, credited: amount, offer: offerName }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
