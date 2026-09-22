import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function timingSafeEqualText(a: string, b: string): boolean { if (!a || !b || a.length !== b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }

Deno.serve(async (req) => {
  try {
    const POSTBACK_PASSWORD = Deno.env.get("CPALEAD_POSTBACK_PASSWORD")!;

    const url = new URL(req.url);
    const password = url.searchParams.get("password");
    const subid = url.searchParams.get("subid");
    const payout = url.searchParams.get("payout");
    const leadId = url.searchParams.get("lead_id");

    if (!timingSafeEqualText(password || "", POSTBACK_PASSWORD)) {
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
    if (!Number.isFinite(totalPayout) || totalPayout <= 0 || totalPayout > 100000) return new Response("Invalid payout", { status: 400 });
    const userShare = totalPayout * 0.6;
    const creditId = leadId || `cpalead:${subid}:${crypto.randomUUID()}`;
    const { data: credit, error: creditError } = await supabase.rpc("credit_offerwall_atomic", {
      p_click_id: creditId, p_telegram_id: Number(subid), p_payout_usd: totalPayout, p_user_share: userShare
    });
    if (creditError) throw creditError;
    if (!credit?.processed) return new Response("Duplicate, already processed", { status: 200 });
    if (credit.referred_by) {
      const { data: settingsRows } = await supabase.from("settings").select("key, value");
      const settingsMap: Record<string,string> = {}; (settingsRows || []).forEach((r) => { settingsMap[r.key] = r.value; });
      const commissionPercent = Number(settingsMap.referral_commission_percent ?? 3);
      await supabase.rpc("add_referral_commission", { ref_telegram_id: credit.referred_by, commission_amount: userShare * (commissionPercent / 100) });
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Error: " + String(err), { status: 500 });
  }
});
