import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const POSTBACK_PASSWORD = Deno.env.get("CPALEAD_POSTBACK_PASSWORD")!;

    const url = new URL(req.url);
    const password = url.searchParams.get("password");
    const subid = url.searchParams.get("subid");
    const payout = url.searchParams.get("payout");
    const leadId = url.searchParams.get("lead_id");

    if (password !== POSTBACK_PASSWORD) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!subid || !payout) {
      return new Response("Missing parameters", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", subid)
      .single();

    if (userError || !user) {
      return new Response("User not found", { status: 404 });
    }

    if (leadId) {
      const { data: existing } = await supabase
        .from("offerwall_transactions")
        .select("id")
        .eq("click_id", leadId)
        .maybeSingle();

      if (existing) {
        return new Response("Duplicate, already processed", { status: 200 });
      }
    }

    const totalPayout = Number(payout);
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

    if (leadId) {
      await supabase.from("offerwall_transactions").insert({
        click_id: leadId,
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
