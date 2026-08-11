import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTasks, mySubmissions } from "../tasks";
import "./Wallet.css";

export default function Tasks() {
  const [tab, setTab] = useState("available");
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([listTasks(), mySubmissions()])
      .then(([t, s]) => {
        setTasks(t);
        setSubmissions(s);
      })
      .catch(() => setError("Something went wrong loading tasks."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;
  }

  const pendingTaskIds = submissions
    .filter((s) => s.status === "pending")
    .map((s) => s.task_id);

  const availableTasks = tasks.filter((t) => !pendingTaskIds.includes(t.id));
  const pendingSubmissions = submissions.filter((s) => s.status === "pending");
  const processedSubmissions = submissions.filter((s) => s.status !== "pending");

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>📝 Complete Tasks</h1>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>
        Earn rewards by completing simple tasks
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setTab("available")}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "none",
            fontWeight: "bold",
            background: tab === "available" ? "#3b82f6" : "#1e293b",
            color: "white",
          }}
        >
          Available
        </button>
        <button
          onClick={() => setTab("pending")}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "none",
            fontWeight: "bold",
            background: tab === "pending" ? "#3b82f6" : "#1e293b",
            color: "white",
          }}
        >
          Pending
        </button>
        <button
          onClick={() => setTab("history")}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "none",
            fontWeight: "bold",
            background: tab === "history" ? "#3b82f6" : "#1e293b",
            color: "white",
          }}
        >
          History
        </button>
      </div>

      {tab === "available" && (
        availableTasks.length === 0 ? (
          <p style={{ color: "#94a3b8", textAlign: "center" }}>No tasks available right now</p>
        ) : (
          availableTasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="wallet-card"
              style={{ display: "block", marginBottom: 12, textDecoration: "none", color: "white" }}
            >
              <h2>{task.title}</h2>
              <p style={{ color: "#4ade80", fontWeight: "bold" }}>${Number(task.reward_amount).toFixed(2)}</p>
            </Link>
          ))
        )
      )}

      {tab === "pending" && (
        pendingSubmissions.length === 0 ? (
          <p style={{ color: "#94a3b8", textAlign: "center" }}>No pending submissions</p>
        ) : (
          pendingSubmissions.map((sub) => (
            <div key={sub.id} className="wallet-card" style={{ marginBottom: 12 }}>
              <h2>{sub.tasks?.title}</h2>
              <p style={{ color: "#facc15" }}>⏳ Pending review</p>
            </div>
          ))
        )
      )}

      {tab === "history" && (
        processedSubmissions.length === 0 ? (
          <p style={{ color: "#94a3b8", textAlign: "center" }}>No history yet</p>
        ) : (
          processedSubmissions.map((sub) => (
            <div key={sub.id} className="wallet-card" style={{ marginBottom: 12 }}>
              <h2>{sub.tasks?.title}</h2>
              <p style={{ color: sub.status === "approved" ? "#4ade80" : "#f87171" }}>
                {sub.status === "approved" ? "✅ Approved" : "❌ Rejected"}
              </p>
              {sub.admin_comment && (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>{sub.admin_comment}</p>
              )}
            </div>
          ))
        )
      )}
    </div>
  );
}
