import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listWithdrawals, processWithdrawal, getStats, listUsers, toggleUserBan, getSettings, updateSettings } from "../admin";
import "./Admin.css";

export default function Admin() {
  const [tab, setTab] = useState("withdrawals");
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({});

  useEffect(() => { loadData(); }, []);

  function loadData() {
    setLoading(true);
    getStats().then(setStats).catch(() => {});
    listWithdrawals().then(setWithdrawals).catch((err) => setError(err.message || "Failed to load")).finally(() => setLoading(false));
    listUsers("").then(setUsers).catch(() => {});
  }

  async function handleSearch() {
    try {
      setSearching(true);
      setError(null);
      const results = await listUsers(searchTerm);
      setUsers(results || []);
    } catch (err) {
      setError(err.message || "Failed to search users");
    } finally {
      setSearching(false);
    }
  }

  async function handleAction(id, status) {
    setProcessingId(id);
    try {
      const result = await processWithdrawal(id, status, null);
      if (status === "approved") alert("Payout sent! Track ID: " + (result.trackId || "N/A"));
      loadData();
    } catch (err) { alert(err.message || "Action failed"); }
    finally { setProcessingId(null); }
  }

  async function handleToggleBan(telegramId) {
    try { await toggleUserBan(telegramId); listUsers(searchTerm).then(setUsers); }
    catch (err) { alert(err.message || "Failed to update ban status"); }
  }

  async function handleSaveSettings() {
    try {
      await updateSettings(settingsForm);
      alert("Settings updated!");
      getSettings().then((s) => { setSettings(s); setSettingsForm(s); });
    } catch (err) { alert(err.message || "Failed to update settings"); }
  }

  function handleSettingChange(key, value) { setSettingsForm((prev) => ({ ...prev, [key]: value })); }

  if (loading) return <div className="admin-shell">Loading...</div>;
  if (error) return <div className="admin-denied"><h2>Access Denied</h2><p>{error}</p></div>;

  return (
    <div style={{ padding: 16 }}>
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p style={{ color: "#94a3b8" }}>Manage your platform</p>
        <div className="admin-nav-grid">
          <Link to="/admin/tasks" style={{ textDecoration: "none" }}><div className="admin-nav-card">Manage Tasks</div></Link>
          <Link to="/admin/submissions" style={{ textDecoration: "none" }}><div className="admin-nav-card">Review Submissions</div></Link>
          <Link to="/admin/campaigns" style={{ textDecoration: "none" }}><div className="admin-nav-card">Notifications & Campaigns</div></Link>
          <Link to="/admin/settings" style={{ textDecoration: "none" }}><div className="admin-nav-card">Platform Settings</div></Link>
          <Link to="/admin/referrals" style={{ textDecoration: "none" }}><div className="admin-nav-card">Referral Analytics</div></Link>
        </div>
      </div>

      {stats && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}><p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>Total Users</p><p style={{ fontSize: 20, fontWeight: "bold", margin: 0 }}>{stats.totalUsers}</p></div>
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}><p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>Ads Today</p><p style={{ fontSize: 20, fontWeight: "bold", margin: 0 }}>{stats.adsToday}</p></div>
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}><p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>Total Balance Owed</p><p style={{ fontSize: 18, fontWeight: "bold", margin: 0, color: "#facc15" }}>${Number(stats.totalBalanceOwed).toFixed(2)}</p></div>
        <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}><p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>Total Withdrawn</p><p style={{ fontSize: 18, fontWeight: "bold", margin: 0, color: "#22c55e" }}>${Number(stats.totalWithdrawn).toFixed(2)}</p></div>
      </div>}

      <div className="admin-tabs">
        <button onClick={() => setTab("withdrawals")} className={`admin-tab ${tab === "withdrawals" ? "active" : ""}`}>Withdrawals</button>
        <button onClick={() => setTab("users")} className={`admin-tab ${tab === "users" ? "active" : ""}`}>Users</button>
      </div>

      {tab === "withdrawals" && <div>{withdrawals.length === 0 ? <p style={{ color: "#94a3b8", textAlign: "center" }}>No withdrawal requests</p> : withdrawals.map((w) => <div className="admin-item" key={w.id}><div className="admin-item-top"><span className="admin-username">@{w.users?.username || w.users?.telegram_id || "unknown"}</span><span className="admin-amount">${Number(w.amount).toFixed(2)}</span></div><div className="admin-address">{w.wallet_address}</div><div style={{ marginBottom: 10, fontSize: 12, color: "#94a3b8" }}>Status: {w.status} - {new Date(w.created_at).toLocaleString()}</div>{w.status === "pending" && <div className="admin-actions"><button className="admin-btn admin-btn-approve" disabled={processingId === w.id} onClick={() => handleAction(w.id, "approved")}>Approve</button><button className="admin-btn admin-btn-reject" disabled={processingId === w.id} onClick={() => handleAction(w.id, "rejected")}>Reject</button></div>}</div>)}</div>}

      {tab === "users" && <div><div style={{ display: "flex", gap: 8, marginBottom: 16 }}><input type="text" placeholder="Search username or Telegram ID" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "white" }} /><button onClick={handleSearch} disabled={searching} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#3b82f6", color: "white", fontWeight: "bold" }}>{searching ? "Searching..." : "Search"}</button></div>{users.length === 0 ? <p style={{ color: "#94a3b8", textAlign: "center" }}>No users found</p> : users.map((u) => <div className="admin-item" key={u.id}><div className="admin-item-top"><span className="admin-username">@{u.username || u.telegram_id}{u.is_admin && " (admin)"}{u.is_banned && " (banned)"}</span><span className="admin-amount">${Number(u.balance).toFixed(2)}</span></div><div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>Earned: ${Number(u.total_earned).toFixed(2)} - Ads: {u.ads_watched} - Referrals: {u.referral_count}</div><div className="admin-user-footer"><span className={`admin-status ${u.is_banned ? "banned" : "active"}`}>{u.is_banned ? "Banned" : "Active"}</span><button className={`admin-ban-btn ${u.is_banned ? "unban" : ""}`} onClick={() => handleToggleBan(u.telegram_id)}>{u.is_banned ? "Unban user" : "Ban user"}</button></div></div>)}</div>}

      {tab === "settings" && settings && <div><p>Use Platform Settings above to manage live platform economics.</p><button onClick={handleSaveSettings}>Save Settings</button></div>}
    </div>
  );
}
