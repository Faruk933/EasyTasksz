import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

const IFRAME_KEY = "9bzv8diekywjbik14erih9csixzxqg";

export default function BitcoTasksOfferwall() {
  const navigate = useNavigate();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    loginWithTelegram()
      .then((user) => {
        const telegramId = user?.telegram_id ?? user?.id;
        if (!telegramId) throw new Error("Could not load Telegram user.");
        const offerwallUrl = `https://bitcotasks.com/offerwall/${IFRAME_KEY}/${encodeURIComponent(String(telegramId))}`;
        if (mounted) setUrl(offerwallUrl);
      })
      .catch((err) => {
        if (mounted) setError(err?.message || "Could not load BitcoTasks.");
      });
    return () => { mounted = false; };
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 42, marginBottom: 12 }}>₿</div>
          <p style={{ color: "#f87171", marginBottom: 18 }}>{error}</p>
          <button type="button" onClick={() => navigate("/offerwall")} style={{ border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700 }}>Back to Offerwalls</button>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div><div style={{ fontSize: 38, marginBottom: 12 }}>₿</div><p style={{ margin: 0, fontWeight: 700 }}>Loading BitcoTasks…</p><p style={{ marginTop: 8, color: "#9ca3af", fontSize: 13 }}>Preparing your personalized task wall.</p></div>
      </div>
    );
  }

  // BitcoTasks CAPTCHA works in a top-level browsing context, not inside our iframe.
  // Navigate the Telegram WebView directly to BitcoTasks so its CAPTCHA can render.
  window.location.assign(url);
  return null;
}
