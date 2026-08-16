import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

const TIMEWALL_OID = import.meta.env.VITE_TIMEWALL_OID;

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

  const iframeUrl = userId && TIMEWALL_OID
    ? `https://timewall.io/users/login?oid=${encodeURIComponent(TIMEWALL_OID)}&uid=${encodeURIComponent(userId)}`
    : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0f14", zIndex: 1000 }}>
      <button
        type="button"
        onClick={() => navigate("/offerwall")}
        aria-label="Close TimeWall"
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 1100,
          width: 40,
          height: 40,
          border: "none",
          borderRadius: "50%",
          background: "rgba(0,0,0,.75)",
          color: "#fff",
          fontSize: 24,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>

      {error ? (
        <div style={{ color: "#f87171", display: "grid", placeItems: "center", height: "100%", padding: 24, textAlign: "center" }}>
          {error}
        </div>
      ) : !TIMEWALL_OID ? (
        <div style={{ color: "#fff", display: "grid", placeItems: "center", height: "100%", padding: 24, textAlign: "center" }}>
          TimeWall placement is pending approval. The offerwall will be available here once the TimeWall placement ID is configured.
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
