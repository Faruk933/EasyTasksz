import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

const BITLABS_TOKEN = "6e482357-b8ef-4e9c-8c7f-4f00aba6ce95";

export default function BitLabsOfferwall() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const user = await loginWithTelegram();
        const telegramId = user?.telegram_id ?? user?.id;
        if (mounted && telegramId) setUserId(String(telegramId));
      } catch (error) {
        console.error("BitLabs auth error:", error);
      }
    }

    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const src = userId
    ? `https://web.bitlabs.ai/?uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(BITLABS_TOKEN)}&theme=DARK&in_app=true&sdk=IFRAME`
    : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0f14", zIndex: 1000 }}>
      <button
        type="button"
        onClick={() => navigate("/offerwall")}
        aria-label="Back to Offerwalls"
        style={{position:"fixed",top:12,left:12,zIndex:1002,border:"1px solid rgba(255,255,255,0.25)",borderRadius:12,padding:"9px 14px",background:"rgba(11,15,20,0.95)",color:"#fff",fontWeight:700,fontSize:14,boxShadow:"0 4px 16px rgba(0,0,0,0.3)",cursor:"pointer"}}
      >
        ← Back
      </button>

      {src ? (
        <iframe
          title="BitLabs Offerwall"
          src={src}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="clipboard-write"
        />
      ) : (
        <div style={{ color: "#fff", display: "grid", placeItems: "center", height: "100%" }}>
          Loading BitLabs…
        </div>
      )}
    </div>
  );
}
