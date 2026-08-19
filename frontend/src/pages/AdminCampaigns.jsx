import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createCampaign, listCampaigns, previewCampaign, processCampaign } from "../campaigns";

const initialForm = { title: "", message: "", campaignType: "one_time", targetType: "all", targetUserId: "", testUserId: "", bonusEnabled: true, bonusAmount: "3.00", isActive: true };

export default function AdminCampaigns() {
  const [form, setForm] = useState(initialForm); const [recipientCount, setRecipientCount] = useState(0); const [history, setHistory] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [progress, setProgress] = useState(null);
  async function refresh() { try { setHistory((await listCampaigns()).campaigns || []); } catch (e) { setError(e.message); } }
  useEffect(() => { refresh(); }, []);
  async function updateTarget(targetType) { setForm((p) => ({ ...p, targetType })); try { setRecipientCount((await previewCampaign(targetType, form.campaignType, form.targetUserId)).recipients || 0); } catch (e) { setError(e.message); } }
  useEffect(() => { previewCampaign(form.targetType, form.campaignType, form.targetUserId).then((r) => setRecipientCount(r.recipients || 0)).catch(() => {}); }, [form.campaignType, form.targetType, form.targetUserId]);
  async function send() {
    if (!form.title.trim() || !form.message.trim()) return setError("Title and message are required.");
    if (form.campaignType === "one_time" && form.targetType === "specific" && !form.targetUserId.trim()) return setError("Enter a Telegram ID for the specific user.");
    if (form.campaignType === "welcome" && form.testUserId.trim() && !/^\d+$/.test(form.testUserId.trim())) return setError("Enter a valid Telegram ID for the welcome test user.");
    const amount = form.bonusEnabled ? Number(form.bonusAmount) : 0; if (form.bonusEnabled && (!Number.isFinite(amount) || amount < 0)) return setError("Enter a valid bonus amount.");
    const isWelcome = form.campaignType === "welcome"; const confirmed = window.confirm(isWelcome ? `Activate this Welcome Campaign for future new users?\n\nBonus: $${amount.toFixed(2)}\n\nEach new user can receive it only once.${form.testUserId.trim() ? `\n\nA test record will also be prepared for Telegram ID ${form.testUserId.trim()}.` : ""}` : `You are about to send this campaign to ${recipientCount.toLocaleString()} users.\n\nBonus: $${amount.toFixed(2)}\n\nContinue?`); if (!confirmed) return;
    setBusy(true); setError(""); setProgress(null);
    try { const created = await createCampaign({ ...form, bonusAmount: amount }); if (!isWelcome) { let result = await processCampaign(created.campaign.id); setProgress(result); while (!result.done) { result = await processCampaign(created.campaign.id); setProgress(result); } } setForm(initialForm); await refresh(); alert(isWelcome ? "Welcome campaign activated. Future new users will receive it once." : "Campaign completed."); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function resume(id) { setBusy(true); setError(""); try { let result = await processCampaign(id); setProgress(result); while (!result.done) { result = await processCampaign(id); setProgress(result); } await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <div style={{ padding: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><h1 style={{ margin: 0 }}>Notifications & Campaigns</h1><p style={{ color: "#94a3b8" }}>Send reusable Telegram notifications or automate a welcome bonus.</p></div><Link to="/admin" style={{ color: "#60a5fa" }}>Back</Link></div>
    {error && <div style={{ background: "#7f1d1d", padding: 10, borderRadius: 10, marginBottom: 12 }}>{error}</div>}
    <div style={{ background: "#1e293b", borderRadius: 14, padding: 14 }}>
      <label>Campaign Type</label><select value={form.campaignType} onChange={(e) => setForm({ ...form, campaignType: e.target.value })} style={inputStyle}><option value="one_time">📢 One-time campaign</option><option value="welcome">🎉 Automatic welcome campaign</option></select>
      <label>Message Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="🎉 Welcome Bonus" style={inputStyle} />
      <label>Message Body</label><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={10} placeholder="Write your detailed notification here..." style={{ ...inputStyle, resize: "vertical" }} />
      {form.campaignType === "one_time" && <><label>Target Users</label><select value={form.targetType} onChange={(e) => updateTarget(e.target.value)} style={inputStyle}><option value="all">All users</option><option value="new">New users (last 7 days)</option><option value="specific">Specific user</option><option value="not_received">Users who have not received this campaign</option></select>{form.targetType === "specific" && <input value={form.targetUserId} onChange={(e) => setForm({ ...form, targetUserId: e.target.value })} placeholder="Telegram ID e.g. 1115177381" inputMode="numeric" style={inputStyle} />}<p style={{ color: "#94a3b8", fontSize: 12 }}>Recipients: {recipientCount.toLocaleString()}</p></>}
      {form.campaignType === "welcome" && <><div style={{ background: "#0f172a", borderRadius: 10, padding: 10, marginBottom: 12, color: "#cbd5e1", fontSize: 13 }}>Future users only. This will not send anything to existing users. Only one active welcome campaign is allowed.</div><label>Test User (optional)</label><input value={form.testUserId} onChange={(e) => setForm({ ...form, testUserId: e.target.value })} placeholder="Telegram ID e.g. 1115177381" inputMode="numeric" style={inputStyle} /><p style={{ color: "#94a3b8", fontSize: 12 }}>A test record is prepared for this existing user; it is not sent or credited until you explicitly process the test.</p></>}
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={form.bonusEnabled} onChange={(e) => setForm({ ...form, bonusEnabled: e.target.checked })} /> Add balance bonus</label>
      {form.bonusEnabled && <input type="number" min="0" step="0.01" value={form.bonusAmount} onChange={(e) => setForm({ ...form, bonusAmount: e.target.value })} style={inputStyle} placeholder="3.00" />}
      <div style={{ background: "#0f172a", borderRadius: 10, padding: 12, margin: "12px 0" }}><strong>Preview</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{form.title || "Your title"}{"\n\n"}{form.message || "Your message"}</div></div>
      <button disabled={busy} onClick={send} style={buttonStyle}>{busy ? "Processing..." : form.campaignType === "welcome" ? "Activate Welcome Campaign" : "Send Campaign"}</button>
      {progress && <p style={{ color: "#94a3b8", fontSize: 12 }}>Processed: {progress.notificationsSent}/{progress.total} · Remaining: {progress.remaining} · Bonuses: {progress.bonusesGiven}</p>}
    </div>
    <h2 style={{ marginTop: 22 }}>Campaign History</h2>
    {history.length === 0 ? <p style={{ color: "#94a3b8" }}>No campaigns yet.</p> : history.map((c) => <div key={c.id} style={{ background: "#1e293b", borderRadius: 12, padding: 12, marginBottom: 10 }}><strong>{c.title}</strong><div style={{ fontSize: 12, color: "#94a3b8", marginTop: 5 }}>{c.campaign_type === "welcome" ? `🎉 Welcome · ${c.is_active ? "ACTIVE" : "inactive"}` : `📢 One-time · Recipients: ${c.recipients}`} · Sent: {c.notificationsSent} · Failed: {c.failed} · Bonus: ${Number(c.bonusDistributed).toFixed(2)}</div><div style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(c.created_at).toLocaleString()}</div>{c.campaign_type === "one_time" && c.notificationsSent < c.recipients && <button disabled={busy} onClick={() => resume(c.id)} style={{ ...buttonStyle, marginTop: 8 }}>Resume</button>}{c.campaign_type === "welcome" && c.test_recipients > 0 && c.test_notifications_sent === 0 && <button disabled={busy} onClick={() => resume(c.id)} style={{ ...buttonStyle, marginTop: 8 }}>Send Test to Test User</button>}</div>)}
  </div>;
}
const inputStyle = { width: "100%", boxSizing: "border-box", padding: 10, margin: "6px 0 12px", borderRadius: 10, border: "1px solid #334155", background: "#0f172a", color: "white" };
const buttonStyle = { width: "100%", padding: 12, border: 0, borderRadius: 10, background: "#3b82f6", color: "white", fontWeight: "bold" };
