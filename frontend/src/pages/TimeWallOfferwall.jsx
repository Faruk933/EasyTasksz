import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

// TimeWall Placement ID is public integration configuration, not a secret.
// Keep the approved OID as a fallback so the offerwall still works if Netlify
// does not inject VITE_TIMEWALL_OID into a particular build context.
const TIMEWALL_OID = import.meta.env.VITE_TIMEWALL_OID || "b46823581c84758a";

export default function TimeWallOfferwall() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const user = await loginWithTelegram();
        const telegramId = user?.telegram_id ?? user?.id;
        if (!telegramId) {
          throw new Error("Could not load Telegram user.");
        }
        if (mounted) setUserId(String(telegramId));
      } catch (err) {
        if (mounted) setError(err?.message || "Could not load Telegram user.");
      }
    }

    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const iframeUrl = userId
    ? `https://timewall.io/users/login?oid=${encodeURIComponent(TIMEWALL_OID)}&uid=${encodeURIComponent(userId)}`
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

      {error ? (
        <div style={{ color: "#f87171", display: "grid", placeItems: "center", height: "100%", padding: 24, textAlign: "center" }}>
          {error}
        </div>
      ) : !iframeUrl ? (
        <div style={{ color: "#fff", display: "grid", placeItems: "center", height: "100%" }}>
          Loading TimeWall…
        </div>
      ) : (
        <iframe
          title="TimeWall Offerwall"
          src={iframeUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="clipboard-write"
        />
      )}
    </div>
  );
}
