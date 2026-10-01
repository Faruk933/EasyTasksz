import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getUserDetails, listUserCompletedTasks } from "../tasksAdmin";
import "./Admin.css";

const money = (n) => "$" + Number(n || 0).toFixed(2);

export default function AdminUserTasks() {
  const { telegramId } = useParams();
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getUserDetails(telegramId), listUserCompletedTasks(telegramId)])
      .then(([details, completed]) => { setData(details); setTasks(completed || []); })
      .catch((err) => setError(typeof err?.message === "string" ? err.message : "Failed to load user details"))
      .finally(() => setLoading(false));
  }, [telegramId]);

  const u = data?.user;
  const s = data?.stats;

  return (
    <div style={{ padding: 16 }}>
      <Link to="/admin" style={{ color: "#93c5fd", textDecoration: "none" }}>← Back to Users</Link>
      <div className="admin-header" style={{ marginTop: 14 }}>
        <h1>{u ? ("@" + (u.username || u.telegram_id)) : "User Details"}</h1>
        {u && <p style={{ color: "#94a3b8" }}>{u.first_name || ""}{u.last_name ? " " + u.last_name : ""} · Telegram ID: {u.telegram_id}</p>}
      </div>
      {loading && <p style={{ color: "#94a3b8", textAlign: "center" }}>Loading...</p>}
      {!loading && error && <div className="admin-denied"><h2>Could not load user</h2><p>{error}</p></div>}
      {!loading && !error && u && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[["Balance",money(u.balance)],["Total Earned",money(u.total_earned)],["Ads Watched",u.ads_watched],["Ads Today",u.ads_watched_today],["Referrals",u.referral_count],["Tasks Completed",s.completedTasks],["Task Earnings",money(s.taskEarnings)],["Total Withdrawn",money(s.withdrawn)],["Pending Withdrawals",money(s.pendingWithdrawals)],["Status",u.is_banned ? "Banned" : "Active"]].map(([label,value]) => <div key={label} style={{ background:"#1e293b", borderRadius:14, padding:14 }}><p style={{fontSize:12,color:"#94a3b8",margin:"0 0 4px"}}>{label}</p><p style={{fontSize:20,fontWeight:"bold",margin:0}}>{value}</p></div>)}
      </div><div style={{ color:"#94a3b8", fontSize:13, marginBottom:16 }}>Account created: {u.created_at ? new Date(u.created_at).toLocaleString() : "—"}{u.is_admin ? " · Admin account" : ""}</div>
      <h2>Completed Tasks</h2>
      {tasks.length === 0 ? <p style={{color:"#94a3b8"}}>No completed tasks yet.</p> : tasks.map((sub) => <div className="admin-item" key={sub.id}><div className="admin-item-top"><span className="admin-username">{sub.tasks?.title || "Task"}</span><span className="admin-amount">+{money(sub.tasks?.reward_amount)}</span></div><div style={{color:"#94a3b8",fontSize:12}}>Completed: {new Date(sub.created_at).toLocaleString()}</div></div>)}</>}
    </div>
  );
}
