import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyTelegramData(initData:string, botToken:string):Promise<any|null>{
  const params=new URLSearchParams(initData),hash=params.get("hash"); if(!hash)return null; params.delete("hash");
  const pairs:string[]=[]; params.forEach((v,k)=>pairs.push(`${k}=${v}`)); pairs.sort();
  const e=new TextEncoder(),sk=await crypto.subtle.importKey("raw",e.encode("WebAppData"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const ss=await crypto.subtle.sign("HMAC",sk,e.encode(botToken));
  const fk=await crypto.subtle.importKey("raw",ss,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",fk,e.encode(pairs.join("\n")));
  const computed=Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join(""); if(computed!==hash)return null;
  const user=params.get("user"); return user?JSON.parse(user):null;
}

function generateClickId(){const b=new Uint8Array(16);crypto.getRandomValues(b);return Array.from(b).map(x=>x.toString(16).padStart(2,"0")).join("");}
function providerName(value:string){const p=value.trim().toLowerCase(); if(p==="golden goose"||p==="golden-goose"||p==="gg.agency")return "gg.agency"; return p;}

function buildOfferUrl(template:string, provider:string, clickId:string){
  const url=new URL(template);
  const p=providerName(provider);
  for(const [key,value] of url.searchParams.entries()){
    if(value.includes("{CLICK_ID}")||value.includes("ADD_CLICK_ID_HERE")) url.searchParams.set(key,value.replaceAll("{CLICK_ID}",clickId).replaceAll("ADD_CLICK_ID_HERE",clickId));
    if(value.includes("{SOURCE_ID}")) url.searchParams.set(key,value.replaceAll("{SOURCE_ID}","easytasksz"));
  }
  if(p==="mobidea" && url.searchParams.get("site")==="PASS_SITE_HERE") url.searchParams.delete("site");
  if(p==="mobidea") url.searchParams.set("pub_click_id",clickId);
  if(p==="zeydoo" && !url.searchParams.get("ymid")) throw new Error("Zeydoo offer URL must contain ymid={CLICK_ID}");
  if(p==="gg.agency" && !url.searchParams.has("p1") && !url.searchParams.has("p2")) throw new Error("GG.Agency offer URL must pass the click ID in p1 or p2");
  if(url.toString().includes("{CLICK_ID}")||url.toString().includes("ADD_CLICK_ID_HERE")||url.toString().includes("{SOURCE_ID}")||url.toString().includes("PASS_SITE_HERE")) throw new Error("Offer URL still contains an unresolved tracking placeholder");
  return url.toString();
}

Deno.serve(async req=>{
  const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
  if(req.method==="OPTIONS")return new Response("ok",{headers:C});
  try{
    const BOT=Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const {initData,action,taskId,proofLink}=await req.json();
    if(!initData)return new Response(JSON.stringify({error:"Missing initData"}),{status:400,headers:C});
    const tg=await verifyTelegramData(initData,BOT); if(!tg)return new Response(JSON.stringify({error:"Invalid Telegram data"}),{status:401,headers:C});
    const s=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
    const {data:user,error:userError}=await s.from("users").select("*").eq("telegram_id",tg.id).single();
    if(userError||!user)return new Response(JSON.stringify({error:"User not found"}),{status:404,headers:C});

    if(action==="list-tasks"){
      const {data,error}=await s.from("tasks").select("*").eq("is_active",true).order("created_at",{ascending:false}); if(error)throw error;
      return new Response(JSON.stringify({tasks:data}),{status:200,headers:{...C,"Content-Type":"application/json"}});
    }

    if(action==="start-offer-task"){
      if(!taskId)return new Response(JSON.stringify({error:"Missing taskId"}),{status:400,headers:C});
      const {data:task,error:taskError}=await s.from("tasks").select("id,is_active,task_type,provider,offer_id,task_url").eq("id",taskId).single();
      if(taskError||!task)return new Response(JSON.stringify({error:"Task not found"}),{status:404,headers:C});
      if(!task.is_active)return new Response(JSON.stringify({error:"Task is inactive"}),{status:400,headers:C});
      if(String(task.task_type||"").toLowerCase()!=="offer")return new Response(JSON.stringify({error:"This is not an offer task"}),{status:400,headers:C});
      if(!task.provider||!task.task_url)return new Response(JSON.stringify({error:"Offer task is not configured correctly"}),{status:400,headers:C});
      const provider=providerName(String(task.provider));
      let clickId="",trackedUrl="";
      for(let attempt=0;attempt<3;attempt++){
        clickId=generateClickId();
        const {error}=await s.from("offer_clicks").insert({click_id:clickId,provider,user_id:user.id,task_id:task.id,offer_id:task.offer_id?String(task.offer_id):null});
        if(!error){trackedUrl=buildOfferUrl(String(task.task_url),provider,clickId);break;}
        if(!String(error.message||"").toLowerCase().includes("duplicate"))throw error;
      }
      if(!trackedUrl)throw new Error("Could not create a unique offer click ID");
      return new Response(JSON.stringify({url:trackedUrl}),{status:200,headers:{...C,"Content-Type":"application/json"}});
    }

    if(action==="my-submissions"){
      const {data,error}=await s.from("task_submissions").select("*, tasks(title, reward_amount)").eq("user_id",user.id).order("created_at",{ascending:false}); if(error)throw error;
      return new Response(JSON.stringify({submissions:data}),{status:200,headers:{...C,"Content-Type":"application/json"}});
    }
    if(action==="submit-task"){
      if(!taskId||!proofLink)return new Response(JSON.stringify({error:"Missing taskId or proofLink"}),{status:400,headers:C});
      const {data:task}=await s.from("tasks").select("task_type").eq("id",taskId).single();
      if(String(task?.task_type||"manual").toLowerCase()==="offer")return new Response(JSON.stringify({error:"Offer tasks are completed automatically after conversion"}),{status:400,headers:C});
      const {data:existing}=await s.from("task_submissions").select("id").eq("task_id",taskId).eq("user_id",user.id).eq("status","pending").maybeSingle();
      if(existing)return new Response(JSON.stringify({error:"You already have a pending submission for this task"}),{status:400,headers:C});
      const {data:submission,error}=await s.from("task_submissions").insert({task_id:taskId,user_id:user.id,proof_link:proofLink,status:"pending"}).select().single(); if(error)throw error;
      return new Response(JSON.stringify({submission}),{status:200,headers:{...C,"Content-Type":"application/json"}});
    }
    return new Response(JSON.stringify({error:"Unknown action"}),{status:400,headers:C});
  }catch(err){return new Response(JSON.stringify({error:String(err)}),{status:500,headers:C});}
});
