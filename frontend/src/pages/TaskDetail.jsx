import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listTasks, submitTask, startMobideaTask } from "../tasks";
import "./Wallet.css";

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [proofLink, setProofLink] = useState("");
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    listTasks()
      .then((tasks) => {
        const found = tasks.find((t) => String(t.id) === String(id));
        if (!found) setError("Task not found");
        else setTask(found);
      })
      .catch(() => setError("Something went wrong loading this task."))
      .finally(() => setLoading(false));
  }, [id]);

  const isMobidea = String(task?.provider || "").toLowerCase() === "mobidea";

  async function handleStartTask() {
    setSubmitMessage(null);
    setStarting(true);
    try {
      let targetUrl;
      if (isMobidea) {
        const result = await startMobideaTask(task.id);
        targetUrl = String(result.url || "").trim();
      } else {
        if (!task?.task_url) throw new Error("This task does not have a valid task URL.");
        targetUrl = String(task.task_url).trim();
      }

      try { new URL(targetUrl); } catch { throw new Error("This task has an invalid task URL."); }
      const tg = window.Telegram?.WebApp;
      if (tg?.openLink) tg.openLink(targetUrl);
      else window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setSubmitMessage(err.message || "Failed to start task");
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit() {
    setSubmitMessage(null);
    if (!proofLink) {
      setSubmitMessage("Please paste your proof link");
      return;
    }
    setSubmitting(true);
    try {
      await submitTask(task.id, proofLink);
      setSubmitMessage("✅ Submitted! Awaiting admin review.");
      setTimeout(() => navigate("/tasks"), 1500);
    } catch (err) {
      setSubmitMessage(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{task.title}</h1>
      <p style={{ color: "#4ade80", fontWeight: "bold", marginBottom: 16 }}>
        Reward: ${Number(task.reward_amount).toFixed(2)}
      </p>

      <div className="wallet-card">
        <h2>Instructions</h2>
        <p style={{ color: "#cbd5e1", whiteSpace: "pre-wrap" }}>{task.instructions}</p>
      </div>

      <button className="wallet-btn" onClick={handleStartTask} disabled={starting} style={{ marginTop: 12 }}>
        {starting ? "Starting..." : "Start Task"}
      </button>

      {isMobidea ? (
        <div className="wallet-card" style={{ marginTop: 16 }}>
          <h2>Automatic Completion</h2>
          <p style={{ color: "#94a3b8", fontSize: 13 }}>
            Complete the Mobidea offer. Your reward is credited automatically after the verified conversion postback.
          </p>
          {submitMessage && <p className="wallet-note" style={{ color: "#facc15" }}>{submitMessage}</p>}
        </div>
      ) : (
        <div className="wallet-card" style={{ marginTop: 16 }}>
          <h2>Submit Proof</h2>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>
            Complete the task, then paste your proof link below.
          </p>
          <input
            type="text"
            placeholder="Paste proof link here"
            value={proofLink}
            onChange={(e) => setProofLink(e.target.value)}
            className="wallet-input"
          />
          <button className="wallet-btn" onClick={handleSubmit} disabled={submitting} style={{ marginTop: 12 }}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
          {submitMessage && <p className="wallet-note" style={{ color: "#facc15" }}>{submitMessage}</p>}
        </div>
      )}
    </div>
  );
}
