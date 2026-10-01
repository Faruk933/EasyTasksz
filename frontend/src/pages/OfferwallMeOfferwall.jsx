import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

const backButtonStyle = {position:"fixed",bottom:18,left:18,zIndex:1002,border:"1px solid rgba(255,255,255,0.25)",borderRadius:14,padding:"12px 18px",background:"rgba(11,15,20,0.95)",color:"#fff",fontWeight:700,fontSize:16,boxShadow:"0 4px 16px rgba(0,0,0,0.3)",cursor:"pointer"};

export default function OfferwallMeOfferwall() {
  const navigate = useNavigate();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    loginWithTelegram()
      .then(async () => {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) throw new Error("TELEGRAM_INITDATA_MISSING");
        const response = await fetch("https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/offerwallme-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        const result = await response.json();
        if (!response.ok || !result?.url) {
          throw new Error(result?.error || "Could not create signed Offerwall.me link.");
        }
        if (mounted) setUrl(result.url);
      })
      .catch((err) => {
        if (mounted) setError(err?.message || "Could not load Offerwall.me.");
      });
    return () => { mounted = false; };
  }, []);

  if (error) {
    return <div style={{minHeight:"100vh",background:"#0b0f14",color:"#fff",display:"grid",placeItems:"center",padding:24,textAlign:"center"}}><div><p style={{color:"#f87171",marginBottom:18}}>{error}</p><button type="button" onClick={() => navigate("/offerwall")} aria-label="Back to Offerwalls" style={backButtonStyle}>← Back</button></div></div>;
  }

  if (!url) {
    return <div style={{minHeight:"100vh",background:"#0b0f14",color:"#fff",display:"grid",placeItems:"center",textAlign:"center"}}><div><div style={{fontSize:38,marginBottom:12}}>🎁</div><p style={{margin:0,fontWeight:700}}>Loading Offerwall.me…</p><p style={{marginTop:8,color:"#9ca3af",fontSize:13}}>Preparing your personalized offerwall.</p></div></div>;
  }

  return <div style={{width:"100%",height:"100vh",background:"#0b0f14",position:"fixed",inset:0,zIndex:1000}}>
    <button type="button" onClick={() => navigate("/offerwall")} aria-label="Back to Offerwalls" style={backButtonStyle}>← Back</button>
    <iframe title="Offerwall.me" src={url} scrolling="yes" frameBorder="0" style={{display:"block",width:"100%",height:"100%",border:0}} allow="clipboard-write; fullscreen" />
  </div>;
}
