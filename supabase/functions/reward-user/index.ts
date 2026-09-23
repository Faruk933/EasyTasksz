import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_INIT_MAX_AGE_SECONDS = 300;
const TELEGRAM_FUTURE_SKEW_SECONDS = 30;

function timingSafeEqualHex(a:string,b:string):boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  let diff=0; for(let i=0;i<64;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

async function verifyTelegramData(initData:string,botToken:string):Promise<any|null> {
  const params=new URLSearchParams(initData),hash=params.get("hash"),authDate=Number(params.get("auth_date"));
  if(!hash||!Number.isInteger(authDate)) return null;
  const now=Math.floor(Date.now()/1000);
  if(authDate>now+TELEGRAM_FUTURE_SKEW_SECONDS||now-authDate>TELEGRAM_INIT_MAX_AGE_SECONDS) return null;
  params.delete("hash");
  const pairs:string[]=[]; params.forEach((value,key)=>pairs.push(`${key}=${value}`)); pairs.sort();
  const encoder=new TextEncoder();
  const secretKey=await crypto.subtle.importKey("raw",encoder.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const secretKeySigned=await crypto.subtle.sign("HMAC",secretKey,encoder.encode(botToken));
  const finalKey=await crypto.subtle.importKey("raw",secretKeySigned,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("HMAC",finalKey,encoder.encode(pairs.join("\n")));
  const computedHash=Array.from(new Uint8Array(signature)).map(b=>b.toString(16).padStart(2,"0")).join("");
  if(!timingSafeEqualHex(computedHash,hash)) return null;
  const userStr=params.get("user"); if(!userStr) return null;
  try{return JSON.parse(userStr);}catch{return null;}
}

Deno.serve(async(req)=>{
  const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
  if(req.method==="OPTIONS") return new Response("ok",{headers:C});
  if(req.method!=="POST") return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:C});

  try{
    const {initData,action="claim",ymid}=await req.json();
    if(!initData) return new Response(JSON.stringify({error:"Missing initData"}),{status:400,headers:C});
    const tgUser=await verifyTelegramData(initData,Deno.env.get("TELEGRAM_BOT_TOKEN")!);
    if(!tgUser) return new Response(JSON.stringify({error:"Invalid Telegram data"}),{status:401,headers:C});

    const supabase=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
    if(action==="prepare"){
      if(typeof ymid!=="string"||!/^[-_a-zA-Z0-9:.]{16,128}$/.test(ymid)) return new Response(JSON.stringify({error:"Invalid ad event"}),{status:400,headers:C});
      const {error}=await supabase.from("monetag_ad_rewards").insert({ymid,telegram_id:Number(tgUser.id)});
      if(error&&error.code!=="23505") throw error;
      return new Response(JSON.stringify({ok:true,ymid}),{status:200,headers:{...C,"Content-Type":"application/json"}});
    }

    if(action!=="claim"||typeof ymid!=="string") return new Response(JSON.stringify({error:"Invalid request"}),{status:400,headers:C});
    const {data:ad,error:adError}=await supabase.from("monetag_ad_rewards").select("telegram_id,status").eq("ymid",ymid).maybeSingle();
    if(adError) throw adError;
    if(!ad||Number(ad.telegram_id)!==Number(tgUser.id)) return new Response(JSON.stringify({error:"Ad event not found"}),{status:404,headers:C});
    if(ad.status!=="valued"&&ad.status!=="rewarded") return new Response(JSON.stringify({error:"Ad reward is still being verified"}),{status:202,headers:C});

    const {data:result,error}=await supabase.rpc("reward_monetag_ad_atomic",{p_ymid:ymid});
    if(error){
      const m=error.message||"";
      if(m.includes("Daily ad limit reached")) return new Response(JSON.stringify({error:"Daily ad limit reached"}),{status:429,headers:C});
      if(m.includes("Account is banned")) return new Response(JSON.stringify({error:"Account is banned"}),{status:403,headers:C});
      if(m.includes("Ad reward not confirmed")) return new Response(JSON.stringify({error:"Ad reward is still being verified"}),{status:202,headers:C});
      throw error;
    }
    return new Response(JSON.stringify({user:result?.user,processed:result?.processed!==false}),{status:200,headers:{...C,"Content-Type":"application/json"}});
  }catch(err){
    return new Response(JSON.stringify({error:String(err)}),{status:500,headers:C});
  }
});