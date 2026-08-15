import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTasksAdmin, createTask, updateTask, deleteTask } from "../tasksAdmin";
import "./Wallet.css";

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [taskUrl, setTaskUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formMessage, setFormMessage] = useState(null);

  function loadTasks() {
    setLoading(true);
    listTasksAdmin().then(setTasks).catch(() => setError("Failed to load tasks")).finally(() => setLoading(false));
  }
  useEffect(() => { loadTasks(); }, []);

  async function handleCreate() {
    setFormMessage(null);
    if (!title || !instructions || !rewardAmount || !taskUrl) { setFormMessage("Please fill in all fields"); return; }
    setSubmitting(true);
    try { await createTask(title, instructions, Number(rewardAmount), taskUrl); setTitle(""); setInstructions(""); setRewardAmount(""); setTaskUrl(""); setShowForm(false); loadTasks(); }
    catch (err) { setFormMessage(err.message || "Failed to create task"); }
    finally { setSubmitting(false); }
  }

  async function handleToggleActive(task) {
    try { await updateTask(task.id, { isActive: !task.is_active }); loadTasks(); }
    catch (err) { alert(err.message || "Failed to update task"); }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
    setDeletingId(task.id);
    try { await deleteTask(task.id); setTasks((prev) => prev.filter((item) => item.id !== task.id)); }
    catch (err) { alert(err.message || "Failed to delete task"); }
    finally { setDeletingId(null); }
  }

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <Link to="/admin" style={{ display: "inline-block", color: "#60a5fa", textDecoration: "none", marginBottom: 16, fontWeight: "bold" }}>← Back to Admin Panel</Link>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Manage Tasks</h1>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>Create and manage tasks</p>
      <button className="wallet-btn" onClick={() => setShowForm(!showForm)} style={{ marginBottom: 16 }}>{showForm ? "Cancel" : "+ New Task"}</button>
      {showForm && <div className="wallet-card" style={{ marginBottom: 16 }}>
        <input type="text" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} className="wallet-input" />
        <textarea placeholder="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="wallet-input" style={{ minHeight: 80 }} />
        <input type="number" placeholder="Reward amount (USDT)" value={rewardAmount} onChange={(e) => setRewardAmount(e.target.value)} className="wallet-input" />
        <input type="text" placeholder="Task URL" value={taskUrl} onChange={(e) => setTaskUrl(e.target.value)} className="wallet-input" />
        <button className="wallet-btn" onClick={handleCreate} disabled={submitting}>{submitting ? "Creating..." : "Create Task"}</button>
        {formMessage && <p className="wallet-note" style={{ color: "#facc15" }}>{formMessage}</p>}
      </div>}
      {tasks.length === 0 ? <p style={{ color: "#94a3b8", textAlign: "center" }}>No tasks yet</p> : tasks.map((task) => (
        <div key={task.id} className="wallet-card" style={{ marginBottom: 12 }}>
          <h2>{task.title}</h2>
          <p style={{ color: "#4ade80", fontWeight: "bold" }}>${Number(task.reward_amount).toFixed(2)}</p>
          <p style={{ color: task.is_active ? "#4ade80" : "#94a3b8", fontSize: 13 }}>{task.is_active ? "Active" : "Inactive"}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="wallet-btn" onClick={() => handleToggleActive(task)} style={{ flex: 1, background: task.is_active ? "#7f1d1d" : "#166534" }}>{task.is_active ? "Deactivate" : "Activate"}</button>
            <button className="wallet-btn" onClick={() => handleDelete(task)} disabled={deletingId === task.id} style={{ flex: 1, background: "#991b1b" }}>{deletingId === task.id ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
