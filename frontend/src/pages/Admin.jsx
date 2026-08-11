import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listWithdrawals,
  updateWithdrawalStatus,
  processWithdrawal,
  getStats,
  listUsers,
  toggleUserBan,
  getSettings,
  updateSettings,
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
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({});

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
      const result = await processWithdrawal(id, status, null);
      if (status === "approved") {
        alert("Payout sent! Track ID: " + (result.trackId || "N/A"));
      }
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

  async function handleSaveSettings() {
    try {
      await updateSettings(settingsForm);
      alert("Settings updated!");
      getSettings().then((s) => {
        setSettings(s);
        setSettingsForm(s);
      });
    } catch (err) {
      alert(err.message || "Failed to update settings");
    }
  }

  function handleSettingChange(key, value) {
    setSettingsForm((prev) => ({ ...prev, [key]: value }));
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

      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 12 }}>
        <Link to="/admin/tasks" style={{ flex: 1, textDecoration: "none" }}>
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10, textAlign: "center", color: "white", fontWeight: "bold", fontSize: 13 }}>
            Manage Tasks
          </div>
        </Link>
        <Link to="/admin/submissions" style={{ flex: 1, textDecoration: "none" }}>
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 10, textAlign: "center", color: "white", fontWeight: "bold", fontSize: 13 }}>
            Review Submissions
          </div>
        </Link>
      </div>
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

      {tab === "settings" && settings && (
        <div>
          <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#94a3b8" }}>Reward Per Ad ($)</label>
            <input
              type="number"
              step="0.01"
              value={settingsForm.reward_per_ad || ""}
              onChange={(e) => handleSettingChange("reward_per_ad", e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }}
            />
          </div>

          <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#94a3b8" }}>Daily Ad Limit</label>
            <input
              type="number"
              value={settingsForm.daily_ad_limit || ""}
              onChange={(e) => handleSettingChange("daily_ad_limit", e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }}
            />
          </div>

          <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#94a3b8" }}>Minimum Withdrawal ($)</label>
            <input
              type="number"
              step="0.01"
              value={settingsForm.minimum_withdrawal || ""}
              onChange={(e) => handleSettingChange("minimum_withdrawal", e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }}
            />
          </div>

          <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#94a3b8" }}>Withdrawal Fee (%)</label>
            <input
              type="number"
              step="0.1"
              value={settingsForm.withdrawal_fee_percent || ""}
              onChange={(e) => handleSettingChange("withdrawal_fee_percent", e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }}
            />
          </div>

          <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: "#94a3b8" }}>Referral Commission (%)</label>
            <input
              type="number"
              step="0.1"
              value={settingsForm.referral_commission_percent || ""}
              onChange={(e) => handleSettingChange("referral_commission_percent", e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }}
            />
          </div>

          <button
            onClick={handleSaveSettings}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 12,
              border: "none",
              background: "#16a34a",
              color: "white",
              fontWeight: "bold",
            }}
          >
            Save Settings
          </button>
        </div>
      )}
    </div>
  );
}
