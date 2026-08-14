import { useEffect, useState } from "react";
import { loginWithTelegram } from "../telegramAuth";
import { getPublicSettings } from "../publicSettings";
import "./Referrals.css";

export default function Referrals() {
  const [user, setUser] = useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(null); const [copied,setCopied]=useState(false); const [settings,setSettings]=useState({});
  useEffect(()=>{getPublicSettings().then(setSettings).catch(()=>{});loginWithTelegram().then(u=>u?setUser(u):setError("Could not load Telegram user. Open this app from your Telegram bot.")).catch(()=>setError("Something went wrong loading your referrals.")).finally(()=>setLoading(false));},[]);
  const referralLink=user?`https://t.me/Easytasksz_bot/EasyTasksz?startapp=${user.referral_code}`:"";
  function handleCopy(){navigator.clipboard.writeText(referralLink);setCopied(true);setTimeout(()=>setCopied(false),2000)}
  if(loading)return <div style={{padding:16}}>Loading...</div>; if(error)return <div style={{padding:16,color:"#f87171"}}>{error}</div>;
  return <div className="referrals-page">
    <section className="referrals-hero"><p className="eyebrow">GROW YOUR EARNINGS</p><h1>👥 Referrals</h1><p>Invite friends and earn {settings.referral_commission_percent??3}% of their eligible earnings.</p></section>
    <div className="referral-card"><h2>🔗 Your Referral Link</h2><div className="referral-link-box"><span className="referral-link-text">{referralLink}</span></div><button className="referral-copy-btn" onClick={handleCopy}>{copied?"✓ Link Copied":"📋 Copy Referral Link"}</button></div>
    <div className="referral-stats-row"><div className="referral-stat"><p>👥 TOTAL REFERRALS</p><h3>{user?.referral_count??0}</h3></div><div className="referral-stat"><p>💰 REFERRAL EARNINGS</p><h3>${Number(user?.referral_earnings??0).toFixed(2)}</h3></div></div>
  </div>;
}
