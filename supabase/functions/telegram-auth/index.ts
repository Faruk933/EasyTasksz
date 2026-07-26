import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyTelegramData(initData: string): Promise<any | null> {
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
    encoder.encode(BOT_TOKEN)
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
  const user = JSON.parse(userStr);
  const startParam = params.get("start_param");
  return { ...user, __start_param: startParam };
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
    const { initData } = await req.json();
    if (!initData) {
      return new Response(JSON.stringify({ error: "Missing initData" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const tgUser = await verifyTelegramData(initData);
    if (!tgUser) {
      return new Response(JSON.stringify({ error: "Invalid Telegram data" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();

    let userRow;
    if (existing) {
      const { data, error } = await supabase
        .from("users")
        .update({
          username: tgUser.username ?? existing.username,
          first_name: tgUser.first_name ?? existing.first_name,
          last_name: tgUser.last_name ?? existing.last_name,
          photo_url: tgUser.photo_url ?? existing.photo_url,
        })
        .eq("telegram_id", tgUser.id)
        .select()
        .single();
      if (error) throw error;
      userRow = data;
    } else {
      const referralCode = "EZ" + Math.random().toString(36).substring(2, 8).toUpperCase();

    let referredByTelegramId = null;
    const startParam = tgUser.__start_param;
    if (startParam) {
      const { data: referrer } = await supabase
        .from("users")
        .select("telegram_id")
        .eq("referral_code", startParam)
        .maybeSingle();
      if (referrer && referrer.telegram_id !== tgUser.id) {
        referredByTelegramId = referrer.telegram_id;
      }
    }
      const { data, error } = await supabase
        .from("users")
        .insert({
          telegram_id: tgUser.id,
          username: tgUser.username ?? null,
          first_name: tgUser.first_name ?? null,
          last_name: tgUser.last_name ?? null,
          photo_url: tgUser.photo_url ?? null,
          balance: 0,
          referral_code: referralCode,
      referred_by: referredByTelegramId,
          total_earned: 0,
          ads_watched: 0,
        })
        .select()
        .single();
    if (referredByTelegramId) {
      await supabase.rpc("increment_referral_count", { ref_telegram_id: referredByTelegramId });
    }
      if (error) throw error;
      userRow = data;
    }

    return new Response(JSON.stringify({ user: userRow }), {
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
