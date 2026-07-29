import { useEffect, useState } from "react";
import {
  listWithdrawals,
  updateWithdrawalStatus,
  getStats,
  listUsers,
  toggleUserBan,
} from "../admin";
import "./Admin.css";

export default function Admin() {
  const [tab, setTab] = useState("withdrawals");
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setLoading(true);
    getStats().then(setStats).catch(() => {});
    listWithdrawals()
      .then(setWithdrawals)
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
    listUsers("").then(setUsers).catch(() => {});
  }

  function handleSearch() {
    listUsers(searchTerm).then(setUsers).catch(() => {});
  }

  async function handleAction(id, status) {
    setProcessingId(id);
    try {
      await updateWithdrawalStatus(id, status);
      loadData();
    } catch (err) {
      alert(err.message || "Action failed");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleToggleBan(telegramId) {
    try {
      await toggleUserBan(telegramId);
      listUsers(searchTerm).then(setUsers);
    } catch (err) {
      alert(err.message || "Failed to update ban status");
    }
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (error) {
    return (
      <div className="admin-denied">
        <h2>Access Denied</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p style={{ color: "#94a3b8" }}>Manage your platform</p>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px 0" }}>Total Users</p>
            <p style={{ fontSize: 20, fontWeight: "bold", margin: 0 }}>{stats.totalUsers}</p>
          </div>
          <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px 0" }}>Ads Today</p>
            <p style={{ fontSize: 20, fontWeight: "bold", margin: 0 }}>{stats.adsToday}</p>
          </div>
          <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px 0" }}>Total Balance Owed</p>
            <p style={{ fontSize: 18, fontWeight: "bold", margin: 0, color: "#facc15" }}>${Number(stats.totalBalanceOwed).toFixed(2)}</p>
          </div>
          <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px 0" }}>Total Withdrawn</p>
            <p style={{ fontSize: 18, fontWeight: "bold", margin: 0, color: "#22c55e" }}>${Number(stats.totalWithdrawn).toFixed(2)}</p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setTab("withdrawals")}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "none",
            fontWeight: "bold",
            background: tab === "withdrawals" ? "#3b82f6" : "#1e293b",
            color: "white",
          }}
        >
          Withdrawals
        </button>
        <button
          onClick={() => setTab("users")}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "none",
            fontWeight: "bold",
            background: tab === "users" ? "#3b82f6" : "#1e293b",
            color: "white",
          }}
        >
          Users
        </button>
      </div>

      {tab === "withdrawals" && (
        <div>
          {withdrawals.length === 0 ? (
            <p style={{ color: "#94a3b8", textAlign: "center" }}>No withdrawal requests</p>
          ) : (
            withdrawals.map((w) => (
              <div className="admin-item" key={w.id}>
                <div className="admin-item-top">
                  <span className="admin-username">
                    @{w.users?.username || w.users?.telegram_id || "unknown"}
                  </span>
                  <span className="admin-amount">${Number(w.amount).toFixed(2)}</span>
                </div>
                <div className="admin-address">{w.wallet_address}</div>
                <div style={{ marginBottom: 10, fontSize: 12, color: "#94a3b8" }}>
                  Status: {w.status} - {new Date(w.created_at).toLocaleString()}
                </div>
                {w.status === "pending" && (
                  <div className="admin-actions">
                    <button
                      className="admin-btn admin-btn-approve"
                      disabled={processingId === w.id}
                      onClick={() => handleAction(w.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      className="admin-btn admin-btn-reject"
                      disabled={processingId === w.id}
                      onClick={() => handleAction(w.id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "users" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search username or Telegram ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #334155",
                background: "#0f172a",
                color: "white",
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: "#3b82f6",
                color: "white",
                fontWeight: "bold",
              }}
            >
              Search
            </button>
          </div>

          {users.length === 0 ? (
            <p style={{ color: "#94a3b8", textAlign: "center" }}>No users found</p>
          ) : (
            users.map((u) => (
              <div className="admin-item" key={u.id}>
                <div className="admin-item-top">
                  <span className="admin-username">
                    @{u.username || u.telegram_id}
                    {u.is_admin && " (admin)"}
                    {u.is_banned && " (banned)"}
                  </span>
                  <span className="admin-amount">${Number(u.balance).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
                  Earned: ${Number(u.total_earned).toFixed(2)} - Ads: {u.ads_watched} - Referrals: {u.referral_count}
                </div>
                <div className="admin-actions">
                  <button
                    className="admin-btn admin-btn-reject"
                    onClick={() => handleToggleBan(u.telegram_id)}
                  >
                    {u.is_banned ? "Unban" : "Ban"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
