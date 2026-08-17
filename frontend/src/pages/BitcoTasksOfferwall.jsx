import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

const IFRAME_KEY = "9bzv8diekywjbik14erih9csixzxqg";
const LAUNCH_FLAG = "easytasksz_bitcotasks_external_active";

export default function BitcoTasksOfferwall() {
  const navigate = useNavigate();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If the user returned from the external BitcoTasks page, never reopen it.
    if (sessionStorage.getItem(LAUNCH_FLAG) === "1") {
      sessionStorage.removeItem(LAUNCH_FLAG);
      navigate("/offerwall", { replace: true });
      return;
    }

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
  }, [navigate]);

  useEffect(() => {
    if (!url) return;

    sessionStorage.setItem(LAUNCH_FLAG, "1");
    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (!opened) {
      // If a popup is blocked, keep the Mini App usable and let the user retry.
      sessionStorage.removeItem(LAUNCH_FLAG);
      setError("BitcoTasks could not be opened. Please tap Open BitcoTasks again.");
      return;
    }

    // Keep the launcher page underneath. When the user returns to Telegram,
    // immediately send them back to the EasyTasksz Offerwalls page instead of
    // leaving the BitcoTasks launcher/CAPTCHA screen visible.
    const returnToOfferwalls = () => {
      if (document.visibilityState === "visible") {
        sessionStorage.removeItem(LAUNCH_FLAG);
        navigate("/offerwall", { replace: true });
      }
    };

    window.addEventListener("focus", returnToOfferwalls);
    document.addEventListener("visibilitychange", returnToOfferwalls);

    return () => {
      window.removeEventListener("focus", returnToOfferwalls);
      document.removeEventListener("visibilitychange", returnToOfferwalls);
    };
  }, [url, navigate]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 42, marginBottom: 12 }}>₿</div>
          <p style={{ color: "#f87171", marginBottom: 18 }}>{error}</p>
          <button type="button" onClick={() => navigate("/offerwall")} style={{ border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700 }}>← Back to Offerwalls</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0b0f14", color: "#fff", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div>
        <div style={{ fontSize: 42, marginBottom: 12 }}>₿</div>
        <p style={{ margin: 0, fontWeight: 700 }}>Opening BitcoTasks…</p>
        <p style={{ marginTop: 8, color: "#9ca3af", fontSize: 13 }}>Complete the CAPTCHA in BitcoTasks. When you return, EasyTasksz will take you back to Offerwalls automatically.</p>
        <button type="button" onClick={() => navigate("/offerwall")} style={{ marginTop: 18, border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700 }}>← Back to Offerwalls</button>
      </div>
    </div>
  );
}
