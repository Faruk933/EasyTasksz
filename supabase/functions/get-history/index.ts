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

const TELEGRAM_INIT_MAX_AGE_SECONDS = 300;
const TELEGRAM_FUTURE_SKEW_SECONDS = 30;
function timingSafeEqualHex(a: string, b: string): boolean { if (!/^[0-9a-f]{64}$/i.test(a)||!/^[0-9a-f]{64}$/i.test(b)) return false; let d=0; for(let i=0;i<64;i++) d|=a.charCodeAt(i)^b.charCodeAt(i); return d===0; }
async function verifyTelegramData(initData: string, botToken: string): Promise<any|null> {
 const params=new URLSearchParams(initData),hash=params.get("hash"),authDate=Number(params.get("auth_date"));
 if(!hash||!Number.isInteger(authDate)) return null; const now=Math.floor(Date.now()/1000);
 if(authDate>now+TELEGRAM_FUTURE_SKEW_SECONDS||now-authDate>TELEGRAM_INIT_MAX_AGE_SECONDS)return null;
 params.delete("hash"); const pairs:string[]=[]; params.forEach((v,k)=>pairs.push(`${k}=${v}`)); pairs.sort();
 const e=new TextEncoder(),sk=await crypto.subtle.importKey("raw",e.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const ss=await crypto.subtle.sign("HMAC",sk,e.encode(botToken)),fk=await crypto.subtle.importKey("raw",ss,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=await crypto.subtle.sign("HMAC",fk,e.encode(pairs.join("\n")));
 const computed=Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join("");
 if(!timingSafeEqualHex(computed,hash))return null; const userStr=params.get("user"); if(!userStr)return null;
 try{return JSON.parse(userStr)}catch{return null}
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

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id,is_banned")
      .eq("telegram_id", tgUser.id)
      .single();

    if (userError || !user) {
return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (user.is_banned) return new Response(JSON.stringify({ error: "Account is banned" }), { status: 403, headers: corsHeaders });

    if (user.is_banned) return new Response(JSON.stringify({ error: "Account is banned" }), { status: 403, headers: corsHeaders });

    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (withdrawalsError) throw withdrawalsError;

    return new Response(JSON.stringify({ withdrawals }), {
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
