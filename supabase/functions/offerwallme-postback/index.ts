import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import md5 from "npm:md5@2.3.0";

function fmt(v: number) { return v.toFixed(8).replace(/0+$/, "").replace(/\.$/, "") || "0"; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const body = await req.formData();
    const subId = String(body.get("subId") ?? "");
    const transId = String(body.get("transId") ?? "");
    const reward = String(body.get("reward") ?? "");
    const payout = Number(body.get("payout") ?? "0");
    const offerName = String(body.get("offer_name") ?? "Offerwall.me task");
    const status = String(body.get("status") ?? "1");
    const signature = String(body.get("signature") ?? "");
    const secret = Deno.env.get("OFFERWALLME_SECRET") ?? "";

    if (!secret) return new Response("Server configuration error", { status: 500 });
    if (!subId || !transId || !reward || !signature) return new Response("Missing parameters", { status: 400 });
    if (md5(subId + transId + reward + secret).toLowerCase() !== signature.trim().toLowerCase()) return new Response("ERROR: Signature doesn't match", { status: 403 });
    if (status !== "1") return new Response("ok", { status: 200 });

    const telegramId = Number(subId);
    const rewardAmount = Number(reward);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0 || !Number.isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 100000) return new Response("Invalid parameters", { status: 400 });
    if (!Number.isFinite(payout) || payout < 0 || payout > 100000) return new Response("Invalid payout", { status: 400 });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: credit, error } = await supabase.rpc("credit_offerwall_atomic", {
      p_click_id: `offerwallme:${transId}`, p_telegram_id: telegramId, p_payout_usd: payout, p_user_share: rewardAmount,
    });
    if (error) throw error;
    if (!credit?.processed) return new Response("ok", { status: 200 });

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (botToken) {
      const text = `🎉 Reward Credited!\n\n💰 +$${fmt(rewardAmount)} added to your EasyTasksz balance.\n📋 ${offerName}\n💵 Current Balance: $${fmt(Number(credit.new_balance))}\n\n✅ Your reward has been successfully processed.`;
      try { await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: telegramId, text }) }); } catch (e) { console.error("Offerwall.me Telegram notification error", e); }
    }
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Offerwall.me postback error", err);
    return new Response("Internal error", { status: 500 });
  }
});