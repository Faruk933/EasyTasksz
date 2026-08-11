import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const POSTBACK_TOKEN = Deno.env.get("PIXYLABS_POSTBACK_TOKEN")!;

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("user_id");
    const clickId = url.searchParams.get("click_id");
    const payoutUsd = url.searchParams.get("payout_usd");

    if (token !== POSTBACK_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!userId || !payoutUsd) {
      return new Response("Missing parameters", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (userError || !user) {
      return new Response("User not found", { status: 404 });
    }

    if (clickId) {
      const { data: existing } = await supabase
        .from("offerwall_transactions")
        .select("id")
        .eq("click_id", clickId)
        .maybeSingle();

      if (existing) {
        return new Response("Duplicate, already processed", { status: 200 });
      }
    }

    const totalPayout = Number(payoutUsd);
    const userShare = totalPayout * 0.6;

    const newBalance = Number(user.balance ?? 0) + userShare;
    const newTotalEarned = Number(user.total_earned ?? 0) + userShare;

    await supabase
      .from("users")
      .update({ balance: newBalance, total_earned: newTotalEarned })
      .eq("id", user.id);

    if (user.referred_by) {
      const { data: settingsRows } = await supabase.from("settings").select("key, value");
      const settingsMap: Record<string, string> = {};
      (settingsRows || []).forEach((r) => { settingsMap[r.key] = r.value; });
      const commissionPercent = Number(settingsMap.referral_commission_percent ?? 3);
      const commission = userShare * (commissionPercent / 100);

      await supabase.rpc("add_referral_commission", {
        ref_telegram_id: user.referred_by,
        commission_amount: commission,
      });
    }

    if (clickId) {
      await supabase.from("offerwall_transactions").insert({
        click_id: clickId,
        user_id: user.id,
        payout_usd: totalPayout,
        user_share: userShare,
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Error: " + String(err), { status: 500 });
  }
});
