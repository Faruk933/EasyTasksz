import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";

export default function Profile() {
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
      .catch(() => setError("Something went wrong loading your profile."))
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {user?.photo_url && (
          <img
            src={user.photo_url}
            alt="avatar"
            style={{ width: 60, height: 60, borderRadius: "50%" }}
          />
        )}
        <div>
          <div style={{ fontWeight: "bold", fontSize: 18 }}>
            {user?.first_name} {user?.last_name}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            @{user?.username || "no_username"}
          </div>
        </div>
      </div>

      <div style={{ background: "#1e293b", borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 4px 0" }}>Telegram ID</p>
        <p style={{ margin: 0 }}>{user?.telegram_id}</p>
      </div>

      <div style={{ background: "#1e293b", borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 4px 0" }}>Referral Code</p>
        <p style={{ margin: 0 }}>{user?.referral_code}</p>
      </div>

      {user?.is_admin && (
        <Link to="/admin" style={{ textDecoration: "none" }}>
          <div style={{ background: "#7c3aed", borderRadius: 16, padding: 16, textAlign: "center", fontWeight: "bold" }}>
            🛠️ Admin Panel
          </div>
        </Link>
      )}
    </div>
  );
}
