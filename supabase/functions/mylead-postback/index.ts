import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
Deno.serve(async req=>{try{
  const u=new URL(req.url),p=u.searchParams;
  const transactionId=p.get("transaction_id")||p.get("transactionid")||p.get("txid")||p.get("clickid");
  const playerId=p.get("player_id")||p.get("playerid");
  const status=(p.get("status")||"").trim().toLowerCase();
  if(!transactionId||!playerId)return new Response("Ignored",{status:200});
  const raw=p.get("payout_decimal")||p.get("payout")||p.get("amount")||"";
  const payoutRaw=raw.replace(/,/g,"");
  const payout=Number(payoutRaw);
  if(!Number.isFinite(payout)||payout<0)return new Response("Ignored",{status:200});
  const s=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
  const {data,error}=await s.rpc("process_mylead_offerwall_conversion",{p_transaction_id:transactionId,p_player_id:playerId,p_payout_usd:payout,p_status:status});
  if(error)throw error;
  const r=Array.isArray(data)?data[0]:data;
  return new Response(r?.processed?"OK":"Already processed, ignored status, or unknown player",{status:200});
}catch(e){return new Response("Error: "+String(e),{status:500});}});
