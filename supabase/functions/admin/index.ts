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
  const { initData, action, withdrawalId, status, search, targetTelegramId, newBalance, settingsUpdates } = await req.json();
  console.log("Received action:", JSON.stringify(action));

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

    const { data: adminCheck, error: adminError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("telegram_id", tgUser.id)
      .single();

    if (adminError || !adminCheck || !adminCheck.is_admin) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (action === "stats") {
      const { count: totalUsers } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      const { data: balanceData } = await supabase
        .from("users")
        .select("balance");
      const totalBalanceOwed = (balanceData || []).reduce(
        (sum, u) => sum + Number(u.balance || 0),
        0
      );

      const { data: withdrawnData } = await supabase
        .from("withdrawals")
        .select("amount")
        .eq("status", "approved");
      const totalWithdrawn = (withdrawnData || []).reduce(
        (sum, w) => sum + Number(w.amount || 0),
        0
      );

      const today = new Date().toISOString().slice(0, 10);
      const { data: adsData } = await supabase
        .from("users")
        .select("ads_watched_today, last_ad_date")
        .eq("last_ad_date", today);
      const adsToday = (adsData || []).reduce(
        (sum, u) => sum + Number(u.ads_watched_today || 0),
        0
      );

      return new Response(
        JSON.stringify({ totalUsers, totalBalanceOwed, totalWithdrawn, adsToday }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list-users") {
      const searchTerm = (search || "").trim();
      let query = supabase
        .from("users")
        .select("id, telegram_id, username, first_name, balance, total_earned, ads_watched, referral_count, is_admin, is_banned")
        .order("id", { ascending: false })
        .limit(50);
      if (searchTerm) {
        query = query.or(`username.ilike.%${searchTerm}%,telegram_id.eq.${searchTerm}`);
      }
      const { data: users, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

  if (action === "get-settings") {
    const { data: settingsRows, error } = await supabase
      .from("settings")
      .select("key, value");
    if (error) throw error;
    const settingsObj = {};
    for (const row of settingsRows || []) {
      settingsObj[row.key] = row.value;
    }
    return new Response(JSON.stringify({ settings: settingsObj }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "update-settings") {
    if (!settingsUpdates || typeof settingsUpdates !== "object") {
      return new Response(JSON.stringify({ error: "Missing settingsUpdates" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const keys = Object.keys(settingsUpdates);
    for (const k of keys) {
      await supabase
        .from("settings")
        .update({ value: String(settingsUpdates[k]), updated_at: new Date().toISOString() })
        .eq("key", k);
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
    }

    if (action === "update-balance") {
      if (!targetTelegramId || newBalance === undefined) {
        return new Response(JSON.stringify({ error: "Missing targetTelegramId or newBalance" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({ balance: Number(newBalance) })
        .eq("telegram_id", targetTelegramId)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ user: updatedUser }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle-ban") {
      if (!targetTelegramId) {
        return new Response(JSON.stringify({ error: "Missing targetTelegramId" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { data: targetUser } = await supabase
        .from("users")
        .select("is_banned")
        .eq("telegram_id", targetTelegramId)
        .single();
      const currentlyBanned = targetUser && targetUser.is_banned;
      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({ is_banned: !currentlyBanned })
        .eq("telegram_id", targetTelegramId)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ user: updatedUser }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data: withdrawals, error } = await supabase
        .from("withdrawals")
        .select("*, users!withdrawals_user_id_fkey(username, telegram_id)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ withdrawals }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-status") {
      if (!withdrawalId || !status) {
        return new Response(JSON.stringify({ error: "Missing withdrawalId or status" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const { data: updated, error } = await supabase
        .from("withdrawals")
        .update({ status, processed_at: new Date().toISOString() })
        .eq("id", withdrawalId)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ withdrawal: updated }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
