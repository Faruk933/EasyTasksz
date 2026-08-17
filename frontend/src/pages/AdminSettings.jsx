import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSettings, updateSettings } from "../admin";

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((data) => setSettings(data || {})).finally(() => setLoading(false));
  }, []);

  function change(key, value) { setSettings((prev) => ({ ...prev, [key]: value })); }

  async function save() {
    setSaving(true);
    try { await updateSettings(settings); alert("Settings updated!"); }
    catch (err) { alert(err.message || "Failed to update settings"); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: 16 }}>Loading settings...</div>;

  const fields = [
    ["reward_per_ad", "Reward Per Ad ($)", "0.01"],
    ["daily_ad_limit", "Daily Ad Limit", "1"],
    ["minimum_withdrawal", "Minimum Withdrawal ($)", "0.01"],
    ["withdrawal_fee_percent", "Withdrawal Fee (%)", "0.1"],
    ["referral_commission_percent", "Referral Commission (%)", "0.1"],
  ];

  const launchAdEnabled = String(settings.launch_ad_enabled).toLowerCase() === "true";

  return (
    <div style={{ padding: 16 }}>
      <Link to="/admin" style={{ display: "inline-block", color: "#60a5fa", textDecoration: "none", marginBottom: 16, fontWeight: "bold" }}>← Back to Admin Panel</Link>
      <h1>Platform Settings</h1>
      <p style={{ color: "#94a3b8" }}>Control platform earning and withdrawal settings.</p>

      <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
          <span>
            <strong style={{ display: "block", color: "white" }}>Launch Monetag Ad</strong>
            <small style={{ display: "block", color: "#94a3b8", marginTop: 4 }}>Show the Monetag in-app ad automatically when the dashboard opens.</small>
          </span>
          <input
            type="checkbox"
            checked={launchAdEnabled}
            onChange={(e) => change("launch_ad_enabled", e.target.checked ? "true" : "false")}
            style={{ width: 22, height: 22, flexShrink: 0 }}
          />
        </label>
      </div>

      {fields.map(([key, label, step]) => (
        <div key={key} style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: "#94a3b8" }}>{label}</label>
          <input type="number" step={step} value={settings[key] ?? ""} onChange={(e) => change(key, e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: 10, marginTop: 6, borderRadius: 8, border: "1px solid #334155", background: "#0f172a", color: "white" }} />
        </div>
      ))}
      <button onClick={save} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#16a34a", color: "white", fontWeight: "bold" }}>{saving ? "Saving..." : "Save Settings"}</button>
    </div>
  );
}
