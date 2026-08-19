import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyTelegramData(initData: string, botToken: string): Promise<any | null> {
  const params = new URLSearchParams(initData); const hash = params.get("hash"); if (!hash) return null; params.delete("hash");
  const pairs: string[] = []; params.forEach((value, key) => pairs.push(`${key}=${value}`)); pairs.sort();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(botToken));
  const finalKey = await crypto.subtle.importKey("raw", signature, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const finalSignature = await crypto.subtle.sign("HMAC", finalKey, encoder.encode(pairs.join("\n")));
  const computed = Array.from(new Uint8Array(finalSignature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (computed !== hash) return null; const user = params.get("user"); return user ? JSON.parse(user) : null;
}
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" } }); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response("ok");
  try {
    const { initData, action, title, message, targetType, targetUserId, campaignType, isActive, bonusEnabled, bonusAmount, campaignId } = await req.json();
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!; const tgUser = await verifyTelegramData(initData || "", botToken); if (!tgUser) return response({ error: "Invalid Telegram data" }, 401);
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: admin, error: adminError } = await db.from("users").select("is_admin").eq("telegram_id", tgUser.id).single(); if (adminError || !admin?.is_admin) return response({ error: "Access denied" }, 403);

    if (action === "preview") {
      if (campaignType === "welcome") return response({ recipients: 0 });
      if (targetType === "specific") return response({ recipients: targetUserId ? 1 : 0 });
      let query = db.from("users").select("id", { count: "exact", head: true });
      if (targetType === "new") query = query.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      if (targetType === "not_received") return response({ recipients: 0 });
      const { count, error } = await query; if (error) throw error; return response({ recipients: count || 0 });
    }

    if (action === "deactivate") {
      const id = Number(campaignId);
      if (!Number.isInteger(id) || id <= 0) return response({ error: "Invalid campaign ID" }, 400);
      const { data: campaign, error: campaignError } = await db.from("campaigns").select("id, campaign_type, is_active").eq("id", id).single();
      if (campaignError || !campaign) return response({ error: "Campaign not found" }, 404);
      if (campaign.campaign_type !== "welcome") return response({ error: "Only welcome campaigns can be deactivated here." }, 400);
      if (!campaign.is_active) return response({ campaign, deactivated: false });
      const { data: updated, error: updateError } = await db.from("campaigns").update({ is_active: false }).eq("id", id).eq("campaign_type", "welcome").eq("is_active", true).select().single();
      if (updateError) throw updateError;
      return response({ campaign: updated, deactivated: true });
    }

    if (action === "create") {
      const cleanTitle = String(title || "").trim(); const cleanMessage = String(message || "").trim(); const type = campaignType === "welcome" ? "welcome" : "one_time"; const amount = bonusEnabled ? Number(bonusAmount || 0) : 0;
      if (!cleanTitle || !cleanMessage) return response({ error: "Title and message are required" }, 400); if (amount < 0 || !Number.isFinite(amount)) return response({ error: "Invalid bonus amount" }, 400);
      if (type === "one_time" && !["all", "new", "specific", "not_received"].includes(targetType)) return response({ error: "Invalid target" }, 400);
      let selectedUserId: number | null = null;
      if (type === "one_time" && targetType === "specific") {
        const telegramId = String(targetUserId || "").trim(); if (!telegramId) return response({ error: "Telegram ID is required" }, 400);
        const { data: target, error: targetError } = await db.from("users").select("id").eq("telegram_id", telegramId).single(); if (targetError || !target) return response({ error: "Target user not found" }, 404); selectedUserId = target.id;
      }
      const { data: campaign, error } = await db.from("campaigns").insert({ title: cleanTitle, message: cleanMessage, target_type: type === "welcome" ? "new" : targetType, target_user_id: selectedUserId, campaign_type: type, is_active: type === "welcome" ? Boolean(isActive) : false, bonus_enabled: Boolean(bonusEnabled), bonus_amount: amount }).select().single();
      if (error) { if (error.code === "23505") return response({ error: "There is already an active welcome campaign. Deactivate it before activating another." }, 409); throw error; }

      if (type === "one_time") {
        let usersQuery = db.from("users").select("id, telegram_id, created_at").order("id", { ascending: true });
        if (targetType === "new") usersQuery = usersQuery.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
        if (targetType === "specific") usersQuery = usersQuery.eq("id", selectedUserId);
        if (targetType === "not_received") {
          const { data: received } = await db.from("campaign_user_records").select("user_id").eq("campaign_id", campaign.id);
          const ids = (received || []).map((r) => r.user_id); if (ids.length) usersQuery = usersQuery.not("id", "in", `(${ids.join(",")})`);
        }
        const { data: users, error: usersError } = await usersQuery; if (usersError) throw usersError;
        if (users?.length) { const records = users.map((u) => ({ campaign_id: campaign.id, user_id: u.id })); for (let i = 0; i < records.length; i += 500) await db.from("campaign_user_records").upsert(records.slice(i, i + 500), { onConflict: "campaign_id,user_id", ignoreDuplicates: true }); }
        return response({ campaign, recipients: users?.length || 0 });
      }
      return response({ campaign, recipients: 0, active: Boolean(isActive) });
    }

    if (action === "process") {
      const id = Number(campaignId); const { data: campaign, error: campaignError } = await db.from("campaigns").select("*").eq("id", id).single(); if (campaignError || !campaign) return response({ error: "Campaign not found" }, 404);
      if (campaign.campaign_type === "welcome") return response({ error: "Welcome campaigns run automatically for new users and cannot be manually processed." }, 400);
      const { data: records, error: recordError } = await db.from("campaign_user_records").select("id, user_id, bonus_given, notification_sent, users(telegram_id)").eq("campaign_id", id).eq("notification_sent", false).order("id", { ascending: true }).limit(50); if (recordError) throw recordError;
      let sent = 0, failed = 0, bonusUsers = 0, bonusTotal = 0;
      for (const record of records || []) {
        const telegramId = (record as any).users?.telegram_id; let bonusGiven = Boolean(record.bonus_given);
        if (campaign.bonus_enabled && Number(campaign.bonus_amount) > 0 && !bonusGiven) {
          const { data: claimed, error: claimError } = await db.from("campaign_user_records").update({ bonus_given: true }).eq("id", record.id).eq("bonus_given", false).select("id").maybeSingle(); if (claimError) throw claimError;
          if (claimed) { const { data: user, error: userError } = await db.from("users").select("balance, total_earned").eq("id", record.user_id).single(); if (userError) throw userError; const amount = Number(campaign.bonus_amount); const { error: balanceError } = await db.from("users").update({ balance: Number(user.balance || 0) + amount, total_earned: Number(user.total_earned || 0) + amount }).eq("id", record.user_id); if (balanceError) throw balanceError; await db.from("transactions").insert({ user_id: record.user_id, type: "bonus", amount, description: `Campaign Bonus: ${campaign.title}` }); bonusGiven = true; bonusUsers++; bonusTotal += amount; }
        }
        if (!telegramId) { await db.from("campaign_user_records").update({ notification_error: "No Telegram ID" }).eq("id", record.id); failed++; continue; }
        try { const text = `*${campaign.title}*\n\n${campaign.message}`; const tg = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: telegramId, text }) }); const result = await tg.json(); if (!tg.ok || !result.ok) throw new Error(result.description || "Telegram send failed"); await db.from("campaign_user_records").update({ notification_sent: true, notification_error: null }).eq("id", record.id); sent++; } catch (err) { await db.from("campaign_user_records").update({ notification_error: String(err) }).eq("id", record.id); failed++; }
      }
      const { count: remaining } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("notification_sent", false); const { count: allSent } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("notification_sent", true); const { count: allBonus } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("bonus_given", true); const { count: total } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", id); return response({ done: (remaining || 0) === 0, remaining: remaining || 0, sent, failed, bonusUsers, bonusTotal, notificationsSent: allSent || 0, bonusesGiven: allBonus || 0, total: total || 0 });
    }

    if (action === "history") {
      const { data: campaigns, error } = await db.from("campaigns").select("*").order("created_at", { ascending: false }).limit(50); if (error) throw error; const result = [];
      for (const campaign of campaigns || []) { const { count: recipients } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id); const { count: notificationsSent } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("notification_sent", true); const { count: failed } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).not("notification_error", "is", null); const { count: bonusesGiven } = await db.from("campaign_user_records").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).eq("bonus_given", true); result.push({ ...campaign, recipients: recipients || 0, notificationsSent: notificationsSent || 0, failed: failed || 0, bonusesGiven: bonusesGiven || 0, bonusDistributed: (bonusesGiven || 0) * Number(campaign.bonus_amount || 0) }); }
      return response({ campaigns: result });
    }
    return response({ error: "Unknown action" }, 400);
  } catch (err) { return response({ error: String(err) }, 500); }
});