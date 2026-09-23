import createAdHandler from "monetag-tg-sdk";

const adHandler = createAdHandler(11203298);
const REWARD_API="https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/reward-user";

export function startLaunchAd() {
  try {
    const tg=window.Telegram?.WebApp;
    if(!tg?.initData) return;
    adHandler({type:"inApp",inAppSettings:{frequency:1,capping:1,interval:1800,timeout:3,everyPage:false}});
  } catch(err) {
    console.warn("Launch ad setup failed:",err);
  }
}

async function rewardRequest(initData,action,ymid){
  const response=await fetch(REWARD_API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData,action,ymid})});
  const result=await response.json();
  return {response,result};
}

export async function watchAdAndReward() {
  const tg=window.Telegram?.WebApp;
  const initData=tg?.initData;
  if(!initData) throw new Error("Not running inside Telegram");

  const ymid="et_"+crypto.randomUUID();

  const prepared=await rewardRequest(initData,"prepare",ymid);
  if(!prepared.response.ok) throw new Error("Backend error: "+(prepared.result.error||"unable to prepare ad"));

  try {
    await adHandler({ymid,requestVar:"watch_ad"});
  } catch(adErr) {
    throw new Error("Ad SDK error: "+(adErr?.message||adErr?.toString()||JSON.stringify(adErr)));
  }

  for(let attempt=0;attempt<8;attempt++){
    const claimed=await rewardRequest(initData,"claim",ymid);
    if(claimed.response.ok) return claimed.result.user;
    if(claimed.response.status===202){
      await new Promise(resolve=>setTimeout(resolve,1500));
      continue;
    }
    throw new Error("Backend error: "+(claimed.result.error||"unknown"));
  }

  throw new Error("Ad was shown, but reward confirmation is still pending. Please try again shortly.");
}
