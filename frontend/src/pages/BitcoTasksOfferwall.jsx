import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

const IFRAME_KEY = "9bzv8diekywjbik14erih9csixzxqg";

export default function BitcoTasksOfferwall() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const openBitcoTasks = () => {
    loginWithTelegram()
      .then((user) => {
        const telegramId = user?.telegram_id ?? user?.id;
        if (!telegramId) throw new Error("Could not load Telegram user.");

        const url = `https://bitcotasks.com/offerwall/${IFRAME_KEY}/${encodeURIComponent(String(telegramId))}`;
        const opened = window.open(url, "_blank", "noopener,noreferrer");

        if (!opened) {
          setError("BitcoTasks could not be opened. Please allow pop-ups and tap Open BitcoTasks again.");
          return;
        }
      })
      .catch((err) => setError(err?.message || "Could not open BitcoTasks."));
  };

  useEffect(() => {
    // This page is only a launcher. It never automatically opens BitcoTasks.
    // Returning from the external browser therefore leaves this page untouched;
    // the user can use the explicit Back button to return to the provider list.
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>₿</div>
        <h2 style={{ margin: 0 }}>BitcoTasks</h2>
        <p style={{ marginTop: 10, color: "#9ca3af", lineHeight: 1.5 }}>
          Tap below to open BitcoTasks. The CAPTCHA will appear there before the offerwall loads.
        </p>

        {error && <p style={{ color: "#f87171", marginTop: 14 }}>{error}</p>}

        <button
          type="button"
          onClick={openBitcoTasks}
          style={{ marginTop: 18, width: "100%", border: 0, borderRadius: 12, padding: "13px 18px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          Open BitcoTasks
        </button>

        <button
          type="button"
          onClick={() => navigate("/offerwall", { replace: true })}
          style={{ marginTop: 12, width: "100%", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "12px 18px", background: "transparent", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          ← Back to Offerwalls
        </button>
      </div>
    </div>
  );
}
