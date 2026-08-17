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

  return (
    <div style={{ width: "100%", minHeight: "100dvh", height: "100dvh", background: "#0b0f14", position: "fixed", inset: 0, zIndex: 1000, overflow: "hidden" }}>
      <button type="button" onClick={() => navigate("/offerwall")} aria-label="Back to Offerwalls" style={{ position: "fixed", top: "max(10px, env(safe-area-inset-top))", left: 10, zIndex: 1002, border: "1px solid rgba(255,255,255,0.25)", borderRadius: 12, padding: "9px 14px", background: "rgba(11,15,20,0.95)", color: "#fff", fontWeight: 700, fontSize: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.3)", cursor: "pointer" }}>← Back</button>
      <iframe
        title="BitcoTasks"
        src={url}
        scrolling="yes"
        frameBorder="0"
        style={{ display: "block", width: "100%", height: "100dvh", minHeight: "900px", border: 0, margin: 0, padding: 0 }}
        allow="clipboard-write; fullscreen; storage-access"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
