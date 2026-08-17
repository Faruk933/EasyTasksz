import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

// Offerwall.me marks this iframe key as public. The provider currently refuses
// to render its wall as a cross-origin iframe, so we open the same wall URL
// directly in the Telegram WebView instead. This preserves subId tracking.
const OFFERWALLME_IFRAME_KEY = "COkR9DZeI3ihOWAcd7yRyayPWDx32P";

export default function OfferwallMeOfferwall() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function openOfferwall() {
      try {
        const user = await loginWithTelegram();
        const telegramId = user?.telegram_id ?? user?.id;
        if (!telegramId) throw new Error("Could not load Telegram user.");

        const url = `https://offerwall.me/iframe/${encodeURIComponent(OFFERWALLME_IFRAME_KEY)}?subId=${encodeURIComponent(String(telegramId))}`;

        // Do not iframe the provider: its response is blocking cross-origin
        // framing (Chrome reports ERR_BLOCKED_BY_RESPONSE). Direct navigation
        // keeps the user in the Telegram WebView and lets Offerwall.me load.
        window.location.replace(url);
      } catch (err) {
        if (mounted) setError(err?.message || "Could not open Offerwall.me.");
      }
    }

    openOfferwall();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      {error ? (
        <div>
          <p style={{ color: "#f87171", marginBottom: 18 }}>{error}</p>
          <button type="button" onClick={() => navigate("/offerwall")} style={{ border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700 }}>
            Back to Offerwalls
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 38, marginBottom: 12 }}>🎁</div>
          <p style={{ margin: 0, fontWeight: 700 }}>Opening Offerwall.me…</p>
          <p style={{ marginTop: 8, color: "#9ca3af", fontSize: 13 }}>Your Telegram account is being attached automatically.</p>
        </div>
      )}
    </div>
  );
}
