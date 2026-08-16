import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

const SMARTLINK = "https://ratwn.bid/cl/0218833c57aca753";

export default function GGAAgencyOfferwall() {
  const navigate = useNavigate();
  const [telegramId, setTelegramId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    loginWithTelegram()
      .then((user) => {
        const id = user?.telegram_id ?? user?.id;
        if (!id) throw new Error("Could not load Telegram user.");
        if (mounted) setTelegramId(String(id));
      })
      .catch((err) => mounted && setError(err?.message || "Could not load Telegram user."));
    return () => { mounted = false; };
  }, []);

  const openSmartLink = () => {
    if (!telegramId) return;
    window.location.href = `${SMARTLINK}?p1=${encodeURIComponent(telegramId)}`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#fff", padding: 16 }}>
      <button type="button" onClick={() => navigate("/offerwall")} style={{ border: 0, background: "transparent", color: "#aaa", fontSize: 14, padding: "8px 0", marginBottom: 10 }}>← Back to Offerwalls</button>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ padding: 22, borderRadius: 22, background: "linear-gradient(135deg,#171b25,#10131b)", border: "1px solid rgba(111,0,255,.28)", marginBottom: 16 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 25 }}>🪿 GG.Agency</h1>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>Complete offers and earn rewards</p>
        </div>
        {error ? <div style={{ padding: 18, borderRadius: 16, background: "#171b25", color: "#f87171" }}>{error}</div> : (
          <div style={{ padding: 18, borderRadius: 18, background: "#11151e", border: "1px solid rgba(255,255,255,.07)" }}>
            <p style={{ marginTop: 0, color: "#d1d5db", lineHeight: 1.5 }}>Browse GG.Agency offers and complete eligible tasks. Your Telegram account is attached automatically so approved conversions can be credited to the correct EasyTasksz balance.</p>
            <button type="button" onClick={openSmartLink} disabled={!telegramId} style={{ width: "100%", padding: 13, border: 0, borderRadius: 12, color: "#fff", fontWeight: 800, background: "linear-gradient(90deg,#6F00FF,#8b5cf6)", opacity: telegramId ? 1 : .55 }}>
              {telegramId ? "Open GG.Agency Offers" : "Loading..."}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
