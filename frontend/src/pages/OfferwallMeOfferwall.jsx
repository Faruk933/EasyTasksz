import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

// Public placement Iframe Key from Offerwall.me.
const OFFERWALLME_IFRAME_KEY = "COkR9DZeI3ihOWAcd7yRyayPWDx32P";

export default function OfferwallMeOfferwall() {
  const navigate = useNavigate();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    loginWithTelegram()
      .then((user) => {
        const telegramId = user?.telegram_id ?? user?.id;
        if (!telegramId) throw new Error("Could not load Telegram user.");

        // Offerwall.me's documented website integration URL:
        // https://offerwall.me/offerwall/[API_KEY]/[USER_ID]
        const offerwallUrl = `https://offerwall.me/offerwall/${encodeURIComponent(OFFERWALLME_IFRAME_KEY)}/${encodeURIComponent(String(telegramId))}`;
        if (mounted) setUrl(offerwallUrl);
      })
      .catch((err) => {
        if (mounted) setError(err?.message || "Could not load Offerwall.me.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <p style={{ color: "#f87171", marginBottom: 18 }}>{error}</p>
          <button type="button" onClick={() => navigate("/offerwall")} style={{ border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700 }}>
            Back to Offerwalls
          </button>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 38, marginBottom: 12 }}>🎁</div>
          <p style={{ margin: 0, fontWeight: 700 }}>Loading Offerwall.me…</p>
          <p style={{ marginTop: 8, color: "#9ca3af", fontSize: 13 }}>Preparing your personalized offerwall.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#0b0f14" }}>
      <iframe
        title="Offerwall.me"
        src={url}
        scrolling="yes"
        frameBorder="0"
        style={{ display: "block", width: "100%", height: "calc(100vh - 0px)", minHeight: 800, border: 0 }}
        allow="clipboard-write; fullscreen"
      />
    </div>
  );
}
