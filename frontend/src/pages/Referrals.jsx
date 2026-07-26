import { useEffect, useState } from "react";
import { loginWithTelegram } from "../telegramAuth";
import "./Referrals.css";

export default function Referrals() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loginWithTelegram()
      .then((u) => {
        if (u) {
          setUser(u);
        } else {
          setError("Could not load Telegram user. Open this app from your Telegram bot.");
        }
      })
      .catch(() => setError("Something went wrong loading your referrals."))
      .finally(() => setLoading(false));
  }, []);

  const referralLink = user
    ? `https://t.me/Easytasksz_bot/EasyTasksz?startapp=${user.referral_code}`
    : "";

  function handleCopy() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>👥 Referrals</h1>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>
        Invite friends and earn 3% of their earnings
      </p>

      <div className="referral-card">
        <h2>Your Referral Link</h2>
        <div className="referral-link-box">
          <span className="referral-link-text">{referralLink}</span>
        </div>
        <button className="referral-copy-btn" onClick={handleCopy}>
          {copied ? "✅ Copied!" : "📋 Copy Link"}
        </button>
      </div>

      <div className="referral-stats-row">
        <div className="referral-stat">
          <p>Total Referrals</p>
          <h3>{user?.referral_count ?? 0}</h3>
        </div>
        <div className="referral-stat">
          <p>Referral Earnings</p>
          <h3>${Number(user?.referral_earnings ?? 0).toFixed(2)}</h3>
        </div>
      </div>
    </div>
  );
}
