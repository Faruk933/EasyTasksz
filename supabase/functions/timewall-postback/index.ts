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
    const newBalance = Number(user.balance ?? 0) + amount;
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
        balance: newBalance,
        total_earned: Number(user.total_earned ?? 0) + amount,
      })
      .eq("id", user.id);

    if (userError) throw userError;

    // Restore the normal Telegram credit alert. Notification failure must not
    // undo or reject a successfully credited TimeWall transaction.
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (botToken) {
      const message = [
        "🎉 *TimeWall Reward Credited!*",
        "",
        `💰 *Amount:* $${amount.toFixed(8)}`,
        `🎁 *Offer:* ${offerName}`,
        `🧾 *Transaction:* ${transactionId}`,
        `💳 *New Balance:* $${newBalance.toFixed(8)}`,
        "",
        "✅ Your reward has been added to your EasyTasksz balance.",
        "🚀 Keep completing offers and keep earning!",
      ].join("\n");

      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramId,
            text: message,
            parse_mode: "Markdown",
          }),
        });

        if (!telegramResponse.ok) {
          console.error("TimeWall Telegram notification failed", await telegramResponse.text());
        }
      } catch (notificationError) {
        console.error("TimeWall Telegram notification error", notificationError);
      }
    } else {
      console.error("TELEGRAM_BOT_TOKEN is not configured; TimeWall notification skipped");
    }

    return jsonResponse({ success: true, credited: amount, offer: offerName });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
