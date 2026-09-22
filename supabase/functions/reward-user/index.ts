import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


const TELEGRAM_INIT_MAX_AGE_SECONDS = 300;
const TELEGRAM_FUTURE_SKEW_SECONDS = 30;

function timingSafeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyTelegramData(initData: string, botToken: string): Promise<any | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !Number.isInteger(authDate)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + TELEGRAM_FUTURE_SKEW_SECONDS || now - authDate > TELEGRAM_INIT_MAX_AGE_SECONDS) return null;
  params.delete("hash");
  const pairs: string[] = [];
  params.forEach((value, key) => pairs.push(`${key}=${value}`));
  pairs.sort();
  const dataCheckString = pairs.join("\n");
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secretKeySigned = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  const finalKey = await crypto.subtle.importKey("raw", secretKeySigned, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", finalKey, encoder.encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!timingSafeEqualHex(computedHash, hash)) return null;
  const userStr = params.get("user");
  if (!userStr) return null;
  try { return JSON.parse(userStr); } catch { return null; }
}


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


    const { data: rewardResult, error: rewardError } = await supabase.rpc("reward_ad_atomic", {
      p_telegram_id: Number(tgUser.id),
      p_reward: rewardPerAd,
      p_daily_limit: dailyLimit,
    });

    if (rewardError) {
      const message = rewardError.message || "";
      if (message.includes("Daily ad limit reached")) {
        return new Response(JSON.stringify({ error: "Daily ad limit reached" }), { status: 429, headers: corsHeaders });
      }
      if (message.includes("Account is banned")) {
        return new Response(JSON.stringify({ error: "Account is banned" }), { status: 403, headers: corsHeaders });
      }
      if (message.includes("User not found")) {
        return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
      }
      throw rewardError;
    }

    const updatedUser = rewardResult?.user;

  if (rewardResult?.referred_by) {
    const commission = rewardPerAd * (commissionPercent / 100);
    await supabase.rpc("add_referral_commission", {
      ref_telegram_id: rewardResult.referred_by,
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
