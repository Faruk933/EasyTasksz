import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userID") ?? url.searchParams.get("userId");
    const transactionId = url.searchParams.get("transactionID") ?? url.searchParams.get("transactionId");
    const currencyAmountRaw = url.searchParams.get("currencyAmount");
    const revenueRaw = url.searchParams.get("revenue");
    const currencyAmount = Number(currencyAmountRaw);
    const revenue = Number(revenueRaw);
    const type = url.searchParams.get("type") ?? "credit";
    const offerName = url.searchParams.get("offername") ?? "TimeWall offer";
    const hash = url.searchParams.get("hash")?.trim().toLowerCase() ?? "";

    if (!userId || !transactionId || !currencyAmountRaw || !revenueRaw || !hash) {
      return jsonResponse({ error: "Missing required postback parameters" }, 400);
    }

    if (!Number.isFinite(currencyAmount) || currencyAmount <= 0) {
      return jsonResponse({ error: "Invalid currencyAmount" }, 400);
    }

    if (!Number.isFinite(revenue) || revenue < 0) {
      return jsonResponse({ error: "Invalid revenue" }, 400);
    }

    const secret = Deno.env.get("TIMEWALL_SECRET_KEY");
    if (!secret) throw new Error("TIMEWALL_SECRET_KEY is not configured");

    // TimeWall postbacks use plain SHA-256(userID + revenue + secret), not HMAC.
    // Keep the raw revenue string because the signature is calculated from the
    // exact value TimeWall sent, not a re-formatted numeric value.
    const digestInput = new TextEncoder().encode(`${userId}${revenueRaw}${secret}`);
    const digest = await crypto.subtle.digest("SHA-256", digestInput);
    const expectedHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    if (hash !== expectedHash) {
      return jsonResponse({ error: "Invalid hash" }, 403);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing, error: lookupError } = await supabase
      .from("offerwall_transactions")
      .select("id")
      .eq("click_id", `timewall:${transactionId}`)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) return jsonResponse({ success: true, duplicate: true });

    if (type !== "credit") {
      return jsonResponse({ success: true, processed: false, type });
    }

    const telegramId = Number(userId);
    if (!Number.isSafeInteger(telegramId)) {
      return jsonResponse({ error: "Invalid userID" }, 400);
    }

    const { data: user, error: userLookupError } = await supabase
      .from("users")
      .select("id,balance,total_earned")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userLookupError) throw userLookupError;
    if (!user) return jsonResponse({ error: "User not found" }, 404);

    const amount = Number(currencyAmount.toFixed(8));
    const { error: txError } = await supabase.from("offerwall_transactions").insert({
      click_id: `timewall:${transactionId}`,
      user_id: user.id,
      payout_usd: revenue,
      user_share: amount,
    });

    if (txError) throw txError;

    const { error: userError } = await supabase
      .from("users")
      .update({
        balance: Number(user.balance ?? 0) + amount,
        total_earned: Number(user.total_earned ?? 0) + amount,
      })
      .eq("id", user.id);

    if (userError) throw userError;

    return jsonResponse({ success: true, credited: amount, offer: offerName });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
