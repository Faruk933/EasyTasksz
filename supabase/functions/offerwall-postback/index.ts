import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function timingSafeEqualText(a: string, b: string): boolean { if (!a || !b || a.length !== b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }

Deno.serve(async (req) => {
  try {
    const POSTBACK_TOKEN = Deno.env.get("PIXYLABS_POSTBACK_TOKEN")!;

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("user_id");
    const clickId = url.searchParams.get("click_id");
    const payoutUsd = url.searchParams.get("payout_usd");

    if (!timingSafeEqualText(token || "", POSTBACK_TOKEN)) {
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
    if (!Number.isFinite(totalPayout) || totalPayout <= 0 || totalPayout > 100000) return new Response("Invalid payout", { status: 400 });
    const userShare = totalPayout * 0.6;
    const creditId = clickId || `pixylabs:${userId}:${crypto.randomUUID()}`;
    const { data: credit, error: creditError } = await supabase.rpc("credit_offerwall_atomic", {
      p_click_id: creditId, p_telegram_id: Number(userId), p_payout_usd: totalPayout, p_user_share: userShare
    });
    if (creditError) throw creditError;
    if (!credit?.processed) return new Response("Duplicate, already processed", { status: 200 });
    if (credit.referred_by) {
      const { data: settingsRows } = await supabase.from("settings").select("key, value");
      const settingsMap: Record<string,string> = {}; (settingsRows || []).forEach((r) => { settingsMap[r.key] = r.value; });
      const commissionPercent = Number(settingsMap.referral_commission_percent ?? 3);
      const { error: referralError } = await supabase.rpc("add_referral_commission", { ref_telegram_id: credit.referred_by, commission_amount: userShare * (commissionPercent / 100) });
      if (referralError) throw referralError;
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Error: " + String(err), { status: 500 });
  }
});
