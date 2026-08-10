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
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secretKeySigned = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    encoder.encode(botToken)
  );
  const finalKey = await crypto.subtle.importKey(
    "raw",
    secretKeySigned,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    finalKey,
    encoder.encode(dataCheckString)
  );
  const computedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHash !== hash) return null;

  const userStr = params.get("user");
  if (!userStr) return null;
  return JSON.parse(userStr);
}

const REWARD_PER_AD = 0.03;
const DAILY_LIMIT = 20;

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const { initData } = await req.json();
    if (!initData) {
      return new Response(JSON.stringify({ error: "Missing initData" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const tgUser = await verifyTelegramData(initData, BOT_TOKEN);
    if (!tgUser) {
      return new Response(JSON.stringify({ error: "Invalid Telegram data" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: settingsRows } = await supabase.from("settings").select("key, value");
    const settingsMap = {};
    (settingsRows || []).forEach((r) => { settingsMap[r.key] = r.value; });
    const rewardPerAd = Number(settingsMap.reward_per_ad ?? REWARD_PER_AD);
    const commissionPercent = Number(settingsMap.referral_commission_percent ?? 3);
    const dailyLimit = Number(settingsMap.daily_ad_limit ?? DAILY_LIMIT);


    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", tgUser.id)
      .single();

    if (fetchError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastAdDate = user.last_ad_date ?? null;
    const adsToday = lastAdDate === today ? (user.ads_watched_today ?? 0) : 0;

    if (adsToday >= dailyLimit) {
      return new Response(JSON.stringify({ error: "Daily ad limit reached" }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    const newBalance = Number(user.balance ?? 0) + rewardPerAd;
    const newTotalEarned = Number(user.total_earned ?? 0) + rewardPerAd;
    const newAdsWatchedToday = adsToday + 1;
    const newAdsWatchedTotal = Number(user.ads_watched ?? 0) + 1;

    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({
        balance: newBalance,
        total_earned: newTotalEarned,
        ads_watched: newAdsWatchedTotal,
        ads_watched_today: newAdsWatchedToday,
        last_ad_date: today,
      })
      .eq("telegram_id", tgUser.id)
      .select()
      .single();

    if (updateError) throw updateError;


  if (user.referred_by) {
    const commission = rewardPerAd * (commissionPercent / 100);
    await supabase.rpc("add_referral_commission", {
      ref_telegram_id: user.referred_by,
      commission_amount: commission,
    });
  }

    return new Response(JSON.stringify({ user: updated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
