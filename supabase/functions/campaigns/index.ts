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
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(botToken));
  const finalKey = await crypto.subtle.importKey("raw", signed, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", finalKey, encoder.encode(pairs.join("\n")));
  const computed = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (computed !== hash) return null;
  const user = params.get("user");
  return user ? JSON.parse(user) : null;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response("ok");
  try {
    const { initData, action, title, message, targetType, bonusEnabled, bonusAmount, campaignId } = await req.json();
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const tgUser = await verifyTelegramData(initData || "", botToken);
    if (!tgUser) return response({ error: "Invalid Telegram data" }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: admin, error: adminError } = await db.from("users").select("is_admin").eq("telegram_id", tgUser.id).single();
    if (adminError || !admin?.is_admin) return response({ error: "Access denied" }, 403);

    if (action === "preview") {
      let query = db.from("users").select("id", { count: "exact", head: true });
      if (targetType === "new") query = query.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      const { count, error } = await query;
      if (error) throw error;
      return response({ recipients: count || 0 });
    }

    if (action === "create") {
      const cleanTitle = String(title || "").trim();
      const cleanMessage = String(message || "").trim();
      const amount = bonusEnabled ? Number(bonusAmount || 0) : 0;
      if (!cleanTitle || !cleanMessage) return response({ error: "Title and message are required" }, 400);
      if (amount < 0 || !Number.isFinite(amount)) return response({ error: "Invalid bonus amount" }, 400);
      if (!['all', 'new'].includes(targetType)) return response({ error: "Invalid target" }, 400);

      const { data: campaign, error } = await db.from("campaigns").insert({ title: cleanTitle, message: cleanMessage, target_type: targetType, bonus_enabled: Boolean(bonusEnabled), bonus_amount: amount }).select().single();
      if (error) throw error;

      let usersQuery = db.from("users").select("id, telegram_id, created_at").order("id", { ascending: true });
      if (targetType === "new") usersQuery = usersQuery.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      const { data: users, error: usersError } = await usersQuery;
      if (usersError) throw usersError;
      if (users?.length) {
        const records = users.map((u) => ({ campaign_id: campaign.id, user_id: u.id }));
        for (let i = 0; i < records.length; i += 500) await db.from("campaign_user_records").upsert(records.slice(i, i + 500), { onConflict: "campaign_id,user_id", ignoreDuplicates: true });
      }
      return response({ campaign, recipients: users?.length || 0 });
    }

    if (action === "process") {
      const id = Number(campaignId);
      const { data: campaign, error: campaignError } = await db.from("campaigns").select("*").eq("id", id).single();
      if (campaignError || !campaign) return response({ error: "Campaign not found" }, 404);
      const { data: records, error: recordError } = await db.from("campaign_user_records").select("id, user_id, bonus_given, notification_sent, users(telegram_id)").eq("campaign_id", id).eq("notification_sent", false).order("id", { ascending: true }).limit(50);
      if (recordError) throw recordError;

      let sent = 0, failed = 0, bonusUsers = 0, bonusTotal = 0;
      for (const record of records || []) {
        const telegramId = (record as any).users?.telegram_id;
        let bonusGiven = Boolean(record.bonus_given);
        if (campaign.bonus_enabled && Number(campaign.bonus_amount) > 0 && !bonusGiven) {
          const { data: claimed, error: claimError } = await db.from("campaign_user_records").update({ bonus_given: true }).eq("id", record.id).eq("bonus_given", false).select("id").maybeSingle();
          if (claimError) throw claimError;
          if (claimed) {
            const { data: user, error: userError } = await db.from("users").select("balance, total_earned").eq("id", record.user_id).single();
            if (userError) throw userError;
            const amount = Number(campaign.bonus_amount);
            const { error: balanceError } = await db.from("users").update({ balance: Number(user.balance || 0) + amount, total_earned: Number(user.total_earned || 0) + amount }).eq("id", record.user_id);
            if (balanceError) throw balanceError;
            bonusGiven = true; bonusUsers++; bonusTotal += amount;
          }
        }

        if (!telegramId) {
          await db.from("campaign_user_records").update({ notification_error: "No Telegram ID" }).eq("id", record.id);
          failed++;
          continue;
        }
        try {
          const text = `*${campaign.title}*\n\n${campaign.message}`;
          const tg = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: telegramId, text }) });
          const result = await tg.json();
          if (!tg.ok || !result.ok) throw new Error(result.description || "Telegram send failed");
          await db.from("campaign_user_records").update({ notification_sent: true, notification_error: null }).eq("id", record.id);
          sent++;
        } catch (err) {
          await db.from("campaign_user_records").update({ notification_error: String(err) }).eq("id", record.id);
          failed++;
        }
      }

      const { count: remaining } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("notification_sent", false);
      const { count: total } = await db.from("campaign_user_records").select("id", { count: "exact", head: true });
      const { count: allSent } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("notification_sent", true);
      const { count: allBonus } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("bonus_given", true);
      return response({ done: (remaining || 0) === 0, remaining: remaining || 0, sent, failed, bonusUsers, bonusTotal, notificationsSent: allSent || 0, bonusesGiven: allBonus || 0, total: total || 0 });
    }

    if (action === "history") {
      const { data: campaigns, error } = await db.from("campaigns").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const result = [];
      for (const campaign of campaigns || []) {
        const { count: recipients } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id);
        const { count: notificationsSent } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("notification_sent", true);
        const { count: failed } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).not("notification_error", "is", null);
        const { count: bonusesGiven } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("bonus_given", true);
        result.push({ ...campaign, recipients: recipients || 0, notificationsSent: notificationsSent || 0, failed: failed || 0, bonusesGiven: bonusesGiven || 0, bonusDistributed: (bonusesGiven || 0) * Number(campaign.bonus_amount || 0) });
      }
      return response({ campaigns: result });
    }

    return response({ error: "Unknown action" }, 400);
  } catch (err) {
    return response({ error: String(err) }, 500);
  }
});
