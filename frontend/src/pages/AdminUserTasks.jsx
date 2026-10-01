import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { listUserCompletedTasks } from "../tasksAdmin";
import "./Admin.css";

export default function AdminUserTasks() {
  const { telegramId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    listUserCompletedTasks(telegramId).then(setTasks).catch((err) => setError(typeof err?.message === "string" ? err.message : "Failed to load completed tasks")).finally(() => setLoading(false));
  }, [telegramId]);
  return (
    <div style={{ padding: 16 }}>
      <Link to="/admin" style={{ color: "#93c5fd", textDecoration: "none" }}>← Back to Users</Link>
      <div className="admin-header" style={{ marginTop: 14 }}><h1>Completed Tasks</h1><p style={{ color: "#94a3b8" }}>Telegram ID: {telegramId}</p></div>
      {loading && <p style={{ color: "#94a3b8", textAlign: "center" }}>Loading...</p>}
      {!loading && error && <div className="admin-denied"><h2>Could not load tasks</h2><p>{error}</p></div>}
      {!loading && !error && tasks.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>No completed tasks yet.</p>}
      {!loading && !error && tasks.map((sub) => <div className="admin-item" key={sub.id}><div className="admin-item-top"><span className="admin-username">{sub.tasks?.title || "Task"}</span><span className="admin-amount">+\${Number(sub.tasks?.reward_amount ?? 0).toFixed(2)}</span></div><div style={{ color: "#94a3b8", fontSize: 12 }}>Completed: {new Date(sub.reviewed_at || sub.created_at).toLocaleString()}</div></div>)}
    </div>
  );
}
