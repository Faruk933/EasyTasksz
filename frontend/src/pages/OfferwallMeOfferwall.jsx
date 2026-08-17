import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

// Offerwall.me marks this iframe key as public, so it is safe to use client-side.
const OFFERWALLME_IFRAME_KEY = "COkR9DZeI3ihOWAcd7yRyayPWDx32P";

export default function OfferwallMeOfferwall() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const user = await loginWithTelegram();
        const telegramId = user?.telegram_id ?? user?.id;
        if (!telegramId) throw new Error("Could not load Telegram user.");
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
    ? `https://offerwall.me/iframe/${encodeURIComponent(OFFERWALLME_IFRAME_KEY)}?subId=${encodeURIComponent(userId)}`
    : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0f14", zIndex: 1000 }}>
      <button
        type="button"
        onClick={() => navigate("/offerwall")}
        aria-label="Close Offerwall.me"
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
      ) : !iframeUrl ? (
        <div style={{ color: "#fff", display: "grid", placeItems: "center", height: "100%" }}>
          Loading Offerwall.me…
        </div>
      ) : (
        <iframe
          title="Offerwall.me"
          src={iframeUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="clipboard-write"
        />
      )}
    </div>
  );
}
