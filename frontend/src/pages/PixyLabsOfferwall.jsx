import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

export default function PixyLabsOfferwall() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loginWithTelegram()
      .then((u) => {
        if (u) {
          setUser(u);
        } else {
          setError("Could not load Telegram user. Open this app from your Telegram bot.");
        }
      })
      .catch(() => setError("Something went wrong loading the offerwall."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;
  }

  const iframeUrl = `https://offerwall.pixylabs.co?pid=505&uid=${user.telegram_id}`;

  return (
    <>
      <iframe
        src={iframeUrl}
        title="PixyLabs Offerwall"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
      <button
        type="button"
        onClick={() => navigate("/offerwall")}
        aria-label="Close offerwall and return to EasyTasksz"
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 9999,
          width: 42,
          height: 42,
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "50%",
          background: "rgba(15,23,42,0.92)",
          color: "#fff",
          fontSize: 24,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        }}
      >
        ×
      </button>
    </>
  );
}
