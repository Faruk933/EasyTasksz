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

  useEffect(() => {
    if (!url) return;
    // Open BitcoTasks in a separate top-level browsing context so its CAPTCHA works,
    // while keeping EasyTasksz alive underneath so returning closes only BitcoTasks.
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Popup blockers may prevent a new context; use the direct navigation as fallback.
      window.location.assign(url);
    }
  }, [url]);

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

  return (
    <div style={{ minHeight: "100dvh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <div style={{ fontSize: 42, marginBottom: 12 }}>₿</div>
        <p style={{ margin: 0, fontWeight: 700 }}>Opening BitcoTasks…</p>
        <p style={{ marginTop: 8, color: "#9ca3af", fontSize: 13 }}>Your task wall is opening in a separate secure page.</p>
        <button type="button" onClick={() => navigate("/offerwall")} style={{ marginTop: 18, border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700 }}>← Back to Offerwalls</button>
      </div>
    </div>
  );
}
