import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const POSTBACK_SECRET_SHA256=Deno.env.get("MONETAG_POSTBACK_SECRET_SHA256")!;
const ZONE_ID="11203298";

async function sha256Hex(value:string):Promise<string>{
  const data=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(data)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function timingSafeEqualText(a:string,b:string):boolean{
  if(!a||!b||a.length!==b.length)return false;
  let diff=0; for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

Deno.serve(async(req)=>{
  if(req.method!=="GET") return new Response("Method not allowed",{status:405});
  try{
    const u=new URL(req.url),p=u.searchParams;
    const supplied=p.get("secret")||p.get("token")||"";
    if(!timingSafeEqualText(await sha256Hex(supplied),POSTBACK_SECRET_SHA256)) return new Response("Unauthorized",{status:401});
    const ymid=p.get("ymid")||"";
    const zone=p.get("zone_id")||p.get("zone")||"";
    const event=p.get("event_type")||p.get("event")||"";
    const rewardEvent=p.get("reward_event_type")||p.get("value")||"";
    const telegramId=p.get("telegram_id")||"";
    const price=Number(p.get("estimated_price")||p.get("amount")||0);
    if(!/^[-_a-zA-Z0-9:.]{16,128}$/.test(ymid)||zone!==ZONE_ID||event!=="impression"||!["yes","valued"].includes(rewardEvent.toLowerCase())) return new Response("Ignored",{status:200});

    const s=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
    const {data:ad,error}=await s.from("monetag_ad_rewards").select("telegram_id,status,expires_at").eq("ymid",ymid).maybeSingle();
    if(error) throw error;
    if(!ad) return new Response("Unknown event",{status:200});
    if(telegramId&&telegramId!==String(ad.telegram_id)) return new Response("Ignored",{status:200});
    if(ad.status==="rewarded"||ad.status==="valued") return new Response("OK",{status:200});
    if(new Date(ad.expires_at).getTime()<Date.now()) return new Response("Expired",{status:200});
    const {error:updateError}=await s.from("monetag_ad_rewards").update({status:"valued",valued_at:new Date().toISOString(),estimated_price:Number.isFinite(price)&&price>0?price:0}).eq("ymid",ymid).eq("status","pending");
    if(updateError) throw updateError;
    return new Response("OK",{status:200});
  }catch(err){return new Response("Error: "+String(err),{status:500});}
});