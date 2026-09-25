import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import md5 from "npm:md5@2.3.0";

const USER_SHARE = 0.60;
function fmt(v: number) { return v.toFixed(8).replace(/0+$/, "").replace(/\.$/, "") || "0"; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const body = await req.formData();
    const subId = String(body.get("subId") ?? "");
    const transId = String(body.get("transId") ?? "");
    const reward = String(body.get("reward") ?? "");
    const payout = Number(body.get("payout") ?? "0");
    const offerName = String(body.get("offer_name") ?? "BitcoTasks task");
    const offerType = String(body.get("offer_type") ?? "task");
    const status = String(body.get("status") ?? "1");
    const signature = String(body.get("signature") ?? "");
    const secret = Deno.env.get("BITCOTASKS_SECRET") ?? "";

    if (!secret) return new Response("Server configuration error", { status: 500 });
    if (!subId || !transId || !reward || !signature || !payout) return new Response("Missing parameters", { status: 400 });
    if (md5(subId + transId + reward + secret).toLowerCase() !== signature.trim().toLowerCase()) return new Response("ERROR: Signature doesn't match", { status: 403 });
    if (status !== "1") return new Response("ok", { status: 200 });

    const telegramId = Number(subId);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0 || !Number.isFinite(payout) || payout <= 0 || payout > 100000) return new Response("Invalid parameters", { status: 400 });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userReward = Number((payout * USER_SHARE).toFixed(6));
    if (!Number.isFinite(userReward) || userReward <= 0 || userReward > 100000) return new Response("Invalid reward", { status: 400 });

    const { data: credit, error } = await supabase.rpc("credit_offerwall_atomic", {
      p_click_id: `bitcotasks:${transId}`, p_telegram_id: telegramId, p_payout_usd: payout, p_user_share: userReward,
    });
    if (error) throw error;
    if (!credit?.processed) return new Response("ok", { status: 200 });

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (botToken) {
      const text = `🎉 Reward Credited!\n\n💰 +$${fmt(userReward)} added to your EasyTasksz balance.\n📋 ${offerName}\n🏷️ ${offerType}\n💵 Current Balance: $${fmt(Number(credit.new_balance))}\n\n✅ Your BitcoTasks reward has been successfully processed.`;
      try { await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: telegramId, text }) }); } catch (e) { console.error("BitcoTasks Telegram notification error", e); }
    }
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("BitcoTasks postback error", err);
    return new Response("Internal error", { status: 500 });
  }
});