import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTasks, mySubmissions } from "../tasks";
import "./Tasks.css";

export default function Tasks() {
  const [tab, setTab] = useState("available");
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([listTasks(), mySubmissions()])
      .then(([t, s]) => { setTasks(t); setSubmissions(s); })
      .catch(() => setError("Something went wrong loading tasks."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="tasks-loading">Loading tasks...</div>;
  if (error) return <div className="tasks-error">{error}</div>;

  const unavailableTaskIds = submissions.filter((s) => s.status === "pending" || s.status === "approved").map((s) => s.task_id);
  const availableTasks = tasks.filter((t) => !unavailableTaskIds.includes(t.id));
  const pendingSubmissions = submissions.filter((s) => s.status === "pending");
  const processedSubmissions = submissions.filter((s) => s.status !== "pending");

  return (
    <div className="tasks-page">
      <header className="tasks-head">
        <h1>📝 Complete Tasks</h1>
        <p>Earn rewards by completing simple tasks</p>
      </header>

      <div className="tasks-tabs">
        {[['available','Available'],['pending','Pending'],['history','History']].map(([value,label]) => (
          <button key={value} className={`tasks-tab ${tab === value ? "active" : ""}`} onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>

      {tab === "available" && (
        availableTasks.length === 0 ? <div className="tasks-empty">No tasks available right now</div> :
        availableTasks.map((task) => (
          <Link key={task.id} to={`/tasks/${task.id}`} className="task-list-card">
            <div className="task-list-card-top">
              <div className="task-list-icon">✓</div>
              <div className="task-list-info"><h2>{task.title}</h2><p>Complete task and earn your reward</p></div>
              <div className="task-reward">${Number(task.reward_amount).toFixed(2)}</div>
            </div>
          </Link>
        ))
      )}

      {tab === "pending" && (
        pendingSubmissions.length === 0 ? <div className="tasks-empty">No pending submissions</div> :
        pendingSubmissions.map((sub) => (
          <div key={sub.id} className="task-list-card">
            <div className="task-list-card-top"><div className="task-list-icon">⏳</div><div className="task-list-info"><h2>{sub.tasks?.title || "Task"}</h2><p>Submission is waiting for review</p></div></div>
            <div className="task-status pending">⏳ Pending review</div>
          </div>
        ))
      )}

      {tab === "history" && (
        processedSubmissions.length === 0 ? <div className="tasks-empty">No history yet</div> :
        processedSubmissions.map((sub) => (
          <div key={sub.id} className="task-list-card">
            <div className="task-list-card-top"><div className="task-list-icon">{sub.status === "approved" ? "✓" : "×"}</div><div className="task-list-info"><h2>{sub.tasks?.title || "Task"}</h2><p>Task submission</p></div></div>
            <div className={`task-status ${sub.status === "approved" ? "approved" : "rejected"}`}>{sub.status === "approved" ? "✅ Approved" : "❌ Rejected"}</div>
            {sub.admin_comment && <p className="task-comment">{sub.admin_comment}</p>}
          </div>
        ))
      )}
    </div>
  );
}
