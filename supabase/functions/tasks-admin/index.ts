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
  const secretKey = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secretKeySigned = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  const finalKey = await crypto.subtle.importKey("raw", secretKeySigned, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", finalKey, encoder.encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (computedHash !== hash) return null;
  const userStr = params.get("user");
  if (!userStr) return null;
  return JSON.parse(userStr);
}

Deno.serve(async (req) => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const { initData, action, taskId, title, instructions, rewardAmount, taskUrl, isActive, submissionId, status, comment } = await req.json();
    if (!initData) return new Response(JSON.stringify({ error: "Missing initData" }), { status: 400, headers: corsHeaders });
    const tgUser = await verifyTelegramData(initData, BOT_TOKEN);
    if (!tgUser) return new Response(JSON.stringify({ error: "Invalid Telegram data" }), { status: 401, headers: corsHeaders });
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: adminCheck, error: adminError } = await supabase.from("users").select("is_admin").eq("telegram_id", tgUser.id).single();
    if (adminError || !adminCheck || !adminCheck.is_admin) return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: corsHeaders });

    if (action === "list-tasks") {
      const { data: tasks, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ tasks }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create-task") {
      if (!title || !instructions || !rewardAmount || !taskUrl) return new Response(JSON.stringify({ error: "Missing task fields" }), { status: 400, headers: corsHeaders });
      const { data: task, error } = await supabase.from("tasks").insert({ title, instructions, reward_amount: rewardAmount, task_url: taskUrl, is_active: true }).select().single();
      if (error) throw error;
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: "@EasyTaskszUpdates", text: "🆕 New Task Available!\n\n📌 " + title + "\n💰 Reward: $" + Number(rewardAmount).toFixed(2) + " USDT\n\n👉 Open EasyTasksz to complete it now!" }) }).catch(() => {});
      return new Response(JSON.stringify({ task }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update-task") {
      if (!taskId) return new Response(JSON.stringify({ error: "Missing taskId" }), { status: 400, headers: corsHeaders });
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (instructions !== undefined) updates.instructions = instructions;
      if (rewardAmount !== undefined) updates.reward_amount = rewardAmount;
      if (taskUrl !== undefined) updates.task_url = taskUrl;
      if (isActive !== undefined) updates.is_active = isActive;
      const { data: task, error } = await supabase.from("tasks").update(updates).eq("id", taskId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ task }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete-task") {
      if (!taskId) return new Response(JSON.stringify({ error: "Missing taskId" }), { status: 400, headers: corsHeaders });

      // Remove dependent submissions first. This prevents foreign-key errors when a
      // task has already been completed/submitted by users.
      const { error: submissionsError } = await supabase
        .from("task_submissions")
        .delete()
        .eq("task_id", taskId);
      if (submissionsError) throw submissionsError;

      const { error: taskError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);
      if (taskError) throw taskError;

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list-submissions") {
      const { data: submissions, error } = await supabase.from("task_submissions").select("*, tasks(title, reward_amount), users(username, telegram_id)").order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ submissions }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "review-submission") {
      if (!submissionId || !status) return new Response(JSON.stringify({ error: "Missing submissionId or status" }), { status: 400, headers: corsHeaders });
      if (status === "rejected" && !comment) return new Response(JSON.stringify({ error: "Comment required for rejection" }), { status: 400, headers: corsHeaders });
      const { data: submission, error: subError } = await supabase.from("task_submissions").select("*, tasks(reward_amount)").eq("id", submissionId).single();
      if (subError || !submission) return new Response(JSON.stringify({ error: "Submission not found" }), { status: 404, headers: corsHeaders });
      const { error: updateError } = await supabase.from("task_submissions").update({ status, admin_comment: comment ?? null, processed_at: new Date().toISOString() }).eq("id", submissionId);
      if (updateError) throw updateError;
      if (status === "approved") {
        const { data: settingsRows } = await supabase.from("settings").select("key, value");
        const settingsMap: Record<string, string> = {};
        (settingsRows || []).forEach((r) => { settingsMap[r.key] = r.value; });
        const commissionPercent = Number(settingsMap.referral_commission_percent ?? 3);
        const { data: user } = await supabase.from("users").select("*").eq("id", submission.user_id).single();
        if (user) {
          const rewardAmt = Number(submission.tasks?.reward_amount ?? 0);
          await supabase.from("users").update({ balance: Number(user.balance ?? 0) + rewardAmt, total_earned: Number(user.total_earned ?? 0) + rewardAmt }).eq("id", user.id);
          if (user.referred_by) await supabase.rpc("add_referral_commission", { ref_telegram_id: user.referred_by, commission_amount: rewardAmt * (commissionPercent / 100) });
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
