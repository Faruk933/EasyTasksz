import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";
import { watchAdAndReward } from "../rewardAds";
import BalanceCard from "../components/BalanceCard";
import "./Dashboard.css";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adMessage, setAdMessage] = useState(null);

  useEffect(() => {
    loginWithTelegram()
      .then((u) => {
        if (u) {
          setUser(u);
        } else {
          setError("Could not load Telegram user. Open this app from your Telegram bot.");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Something went wrong loading your profile.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleWatchAd() {
    setAdMessage(null);
    setAdLoading(true);
    try {
      const updatedUser = await watchAdAndReward();
      setUser(updatedUser);
      setAdMessage("🎉 Reward added!");
    } catch (err) {
      console.error(err);
      setAdMessage(err.message || "Could not complete ad.");
    } finally {
      setAdLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {user?.photo_url && (
          <img
            src={user.photo_url}
            alt="avatar"
            style={{ width: 48, height: 48, borderRadius: "50%" }}
          />
        )}
        <div>
          <div style={{ fontWeight: "bold" }}>
            {user?.first_name} {user?.last_name}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            @{user?.username || "no_username"}
          </div>
        </div>
      </div>

      <BalanceCard balance={user?.balance ?? 0} />

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">🎯</div>
          <p>Ads Today</p>
          <h3>{user?.ads_watched_today ?? 0}/20</h3>
          <div className="stat-progress">
            <div className="stat-progress-fill" style={{ width: ((user?.ads_watched_today ?? 0) / 20 * 100) + "%" }}></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-orange">💰</div>
          <p>Total Earned</p>
          <h3 className="stat-earned">+${user?.total_earned ?? "0.00"}</h3>
        </div>
      </div>

      <button
        className="watch-ads-btn"
        onClick={handleWatchAd}
        disabled={adLoading}
      >
        <div className="watch-ads-icon">▶</div>
        <div className="watch-ads-text">
          <span className="watch-ads-title">{adLoading ? "Loading ad..." : "WATCH & EARN"}</span>
          <span className="watch-ads-subtitle">Watch ads for instant points</span>
        </div>
      </button>

      {adMessage && (
        <div style={{ marginTop: 12, textAlign: "center", color: "#94a3b8" }}>
          {adMessage}
        </div>
      )}

      <div style={{ textAlign: "center", margin: "24px 0 12px 0", color: "#94a3b8", fontSize: 13 }}>
        ⚡ More Ways to Earn ⚡
      </div>

      <Link to="/offerwall" style={{ textDecoration: "none" }}>
        <div style={{ background: "#1e293b", borderRadius: 16, padding: 16, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
            <div>
              <p style={{ fontWeight: "bold", fontSize: 14, margin: 0, color: "white" }}>Offerwall Tasks</p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Complete surveys, apps for rewards</p>
            </div>
          </div>
          <div style={{ background: "#16a34a", color: "white", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: "bold" }}>Open</div>
        </div>
      </Link>
    </div>
  );
}
