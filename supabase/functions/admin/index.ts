// Ban toggle deployment marker
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TELEGRAM_INIT_MAX_AGE_SECONDS = 300;
const TELEGRAM_FUTURE_SKEW_SECONDS = 30;
function timingSafeEqualHex(a:string,b:string):boolean{if(!/^[0-9a-f]{64}$/i.test(a)||!/^[0-9a-f]{64}$/i.test(b))return false;let d=0;for(let i=0;i<64;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function verifyTelegramData(initData:string,botToken:string):Promise<any|null>{
 const p=new URLSearchParams(initData),h=p.get("hash"),ad=Number(p.get("auth_date"));if(!h||!Number.isInteger(ad))return null;
 const now=Math.floor(Date.now()/1000);if(ad>now+TELEGRAM_FUTURE_SKEW_SECONDS||now-ad>TELEGRAM_INIT_MAX_AGE_SECONDS)return null;
 p.delete("hash");const a:string[]=[];p.forEach((v,k)=>a.push(`${k}=${v}`));a.sort();
 const e=new TextEncoder(),sk=await crypto.subtle.importKey("raw",e.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const ss=await crypto.subtle.sign("HMAC",sk,e.encode(botToken)),fk=await crypto.subtle.importKey("raw",ss,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=await crypto.subtle.sign("HMAC",fk,e.encode(a.join("\n"))),ch=Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join("");
 if(!timingSafeEqualHex(ch,h))return null;const u=p.get("user");if(!u)return null;try{return JSON.parse(u)}catch{return null}
}


Deno.serve(async (req) => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const { initData, action, withdrawalId, status, search, targetTelegramId, newBalance, settingsUpdates } = await req.json();
    if (!initData) return new Response(JSON.stringify({ error: "Missing initData" }), { status: 400, headers: corsHeaders });
    const tgUser = await verifyTelegramData(initData, BOT_TOKEN);
    if (!tgUser) return new Response(JSON.stringify({ error: "Invalid Telegram data" }), { status: 401, headers: corsHeaders });
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    if (String(tgUser.id) !== "1115177381") return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: corsHeaders });

    if (action === "stats") {
      const { count: totalUsers } = await supabase.from("users").select("*", { count: "exact", head: true });
      const { data: balanceData } = await supabase.from("users").select("balance");
      const totalBalanceOwed = (balanceData || []).reduce((sum, u) => sum + Number(u.balance || 0), 0);
      const { data: withdrawnData } = await supabase.from("withdrawals").select("amount").eq("status", "approved");
      const totalWithdrawn = (withdrawnData || []).reduce((sum, w) => sum + Number(w.amount || 0), 0);
      const today = new Date().toISOString().slice(0, 10);
      const { data: adsData } = await supabase.from("users").select("ads_watched_today, last_ad_date").eq("last_ad_date", today);
      const adsToday = (adsData || []).reduce((sum, u) => sum + Number(u.ads_watched_today || 0), 0);
      return new Response(JSON.stringify({ totalUsers, totalBalanceOwed, totalWithdrawn, adsToday }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list-users") {
      let searchTerm = String(search || "").trim();
      searchTerm = searchTerm.replace(/^@+/, "");

      const userFields = "id, telegram_id, username, first_name, balance, total_earned, ads_watched, referral_count, is_admin, is_banned";

      if (!searchTerm) {
        const { data: users, error } = await supabase.from("users").select(userFields).order("id", { ascending: false }).limit(50);
        if (error) throw error;
        return new Response(JSON.stringify({ users: users || [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const escaped = searchTerm.replace(/[%_\\]/g, "\\$&");
      const pattern = `%${escaped}%`;

      const { data: usernameUsers, error: usernameError } = await supabase
        .from("users")
        .select(userFields)
        .ilike("username", pattern)
        .order("id", { ascending: false })
        .limit(50);
      if (usernameError) throw usernameError;

      const { data: nameUsers, error: nameError } = await supabase
        .from("users")
        .select(userFields)
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
        .order("id", { ascending: false })
        .limit(50);
      if (nameError) throw nameError;

      let idUsers: any[] = [];
      if (/^\d+$/.test(searchTerm)) {
        const { data, error } = await supabase
          .from("users")
          .select(userFields)
          .eq("telegram_id", Number(searchTerm))
          .limit(50);
        if (error) throw error;
        idUsers = data || [];
      }

      const merged = [...(usernameUsers || []), ...(nameUsers || []), ...idUsers];
      const seen = new Set<number>();
      const users = merged.filter((u) => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      }).slice(0, 50);

      return new Response(JSON.stringify({ users }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get-settings") {
      const { data: settingsRows, error } = await supabase.from("settings").select("key, value");
      if (error) throw error;
      const settings: Record<string, string> = {};
      for (const row of settingsRows || []) settings[row.key] = row.value;
      return new Response(JSON.stringify({ settings }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update-settings") {
      if (!settingsUpdates || typeof settingsUpdates !== "object") return new Response(JSON.stringify({ error: "Missing settingsUpdates" }), { status: 400, headers: corsHeaders });
      for (const [key, value] of Object.entries(settingsUpdates)) {
        const { error } = await supabase.from("settings").update({ value: String(value), updated_at: new Date().toISOString() }).eq("key", key);
        if (error) throw error;
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update-balance") {
      if (!targetTelegramId || newBalance === undefined) return new Response(JSON.stringify({ error: "Missing targetTelegramId or newBalance" }), { status: 400, headers: corsHeaders });
      const parsedBalance = Number(newBalance);
      if (!Number.isFinite(parsedBalance) || parsedBalance < 0 || parsedBalance > 100000000) return new Response(JSON.stringify({ error: "Invalid balance" }), { status: 400, headers: corsHeaders });
      const { data: updatedUser, error } = await supabase.from("users").update({ balance: parsedBalance }).eq("telegram_id", targetTelegramId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ user: updatedUser }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle-ban") {
      if (!targetTelegramId) return new Response(JSON.stringify({ error: "Missing targetTelegramId" }), { status: 400, headers: corsHeaders });
      const { data: targetUser, error: targetError } = await supabase.from("users").select("id, telegram_id, is_banned").eq("telegram_id", targetTelegramId).maybeSingle();
      if (targetError) return new Response(JSON.stringify({ error: "Failed to find user", details: targetError.message, code: targetError.code || null }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!targetUser) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const nextBanned = !Boolean(targetUser.is_banned);
      const { error: updateError } = await supabase.from("users").update({ is_banned: nextBanned }).eq("id", targetUser.id);
      if (updateError) return new Response(JSON.stringify({ error: "Failed to update ban status", details: updateError.message, code: updateError.code || null, hint: updateError.hint || null }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, user: { id: targetUser.id, telegram_id: targetUser.telegram_id, is_banned: nextBanned } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list") {
      const { data: withdrawals, error } = await supabase.from("withdrawals").select("*, users!withdrawals_user_id_fkey(username, telegram_id)").order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ withdrawals }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update-status") {
      if (!withdrawalId || !status) return new Response(JSON.stringify({ error: "Missing withdrawalId or status" }), { status: 400, headers: corsHeaders });
      const { data: updated, error } = await supabase.from("withdrawals").update({ status, processed_at: new Date().toISOString() }).eq("id", withdrawalId).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ withdrawal: updated }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});