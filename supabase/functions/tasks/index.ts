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
  const secretKeySigned = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
  const finalKey = await crypto.subtle.importKey(
    "raw",
    secretKeySigned,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", finalKey, encoder.encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHash !== hash) return null;

  const userStr = params.get("user");
  if (!userStr) return null;
  return JSON.parse(userStr);
}

function generateClickId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildMobideaUrl(taskUrl: string, offerId: string, clickId: string): string {
  const url = new URL(taskUrl);
  const placeholder = url.searchParams.get("site");
  if (placeholder === "PASS_SITE_HERE") url.searchParams.delete("site");
  url.searchParams.set("offer_id", offerId);
  url.searchParams.set("pub_click_id", clickId);
  return url.toString();
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const { initData, action, taskId, proofLink } = await req.json();

    if (!initData) {
      return new Response(JSON.stringify({ error: "Missing initData" }), { status: 400, headers: corsHeaders });
    }

    const tgUser = await verifyTelegramData(initData, BOT_TOKEN);
    if (!tgUser) {
      return new Response(JSON.stringify({ error: "Invalid Telegram data" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", tgUser.id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
    }

    if (action === "list-tasks") {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ tasks }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "start-mobidea-task") {
      if (!taskId) {
        return new Response(JSON.stringify({ error: "Missing taskId" }), { status: 400, headers: corsHeaders });
      }

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("id, is_active, provider, offer_id, task_url")
        .eq("id", taskId)
        .single();

      if (taskError || !task) {
        return new Response(JSON.stringify({ error: "Task not found" }), { status: 404, headers: corsHeaders });
      }
      if (!task.is_active) {
        return new Response(JSON.stringify({ error: "Task is inactive" }), { status: 400, headers: corsHeaders });
      }
      if (String(task.provider || "").toLowerCase() !== "mobidea") {
        return new Response(JSON.stringify({ error: "This is not a Mobidea task" }), { status: 400, headers: corsHeaders });
      }
      if (!task.offer_id || !task.task_url) {
        return new Response(JSON.stringify({ error: "Mobidea task is not configured correctly" }), { status: 400, headers: corsHeaders });
      }

      let clickId = "";
      let trackedUrl = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        clickId = generateClickId();
        const { error: insertError } = await supabase.from("mobidea_clicks").insert({
          click_id: clickId,
          user_id: user.id,
          task_id: task.id,
          offer_id: String(task.offer_id),
        });
        if (!insertError) {
          trackedUrl = buildMobideaUrl(String(task.task_url), String(task.offer_id), clickId);
          break;
        }
        if (!String(insertError.message || "").toLowerCase().includes("duplicate")) throw insertError;
      }

      if (!trackedUrl) throw new Error("Could not create a unique Mobidea click ID");

      return new Response(JSON.stringify({ url: trackedUrl, clickId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "my-submissions") {
      const { data: submissions, error } = await supabase
        .from("task_submissions")
        .select("*, tasks(title, reward_amount)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ submissions }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "submit-task") {
      if (!taskId || !proofLink) {
        return new Response(JSON.stringify({ error: "Missing taskId or proofLink" }), { status: 400, headers: corsHeaders });
      }

      const { data: existing } = await supabase
        .from("task_submissions")
        .select("id")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "You already have a pending submission for this task" }), { status: 400, headers: corsHeaders });
      }

      const { data: submission, error } = await supabase
        .from("task_submissions")
        .insert({ task_id: taskId, user_id: user.id, proof_link: proofLink, status: "pending" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ submission }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
