import { useEffect, useState } from "react";
import { loginWithTelegram } from "../telegramAuth";
import BalanceCard from "../components/BalanceCard";
import "./Dashboard.css";

export default function Dashboard() {
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
      .catch((err) => {
        console.error(err);
        setError("Something went wrong loading your profile.");
      })
      .finally(() => setLoading(false));
  }, []);

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
          <p>Ads Watched</p>
          <h3>{user?.ads_watched ?? 0} / 20</h3>
        </div>
        <div className="stat-card">
          <p>Total Earned</p>
          <h3>${user?.total_earned ?? "0.00"}</h3>
        </div>
      </div>

      <button className="watch-ads-btn">🎥 Watch Ads</button>
    </div>
  );
}
