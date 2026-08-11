import { useEffect, useState } from "react";
import { listSubmissions, reviewSubmission } from "../tasksAdmin";
import "./Wallet.css";

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [comment, setComment] = useState("");
  const [processingId, setProcessingId] = useState(null);

  function loadSubmissions() {
    setLoading(true);
    listSubmissions()
      .then(setSubmissions)
      .catch(() => setError("Failed to load submissions"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function handleApprove(id) {
    setProcessingId(id);
    try {
      await reviewSubmission(id, "approved", null);
      loadSubmissions();
    } catch (err) {
      alert(err.message || "Failed to approve");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id) {
    if (!comment) {
      alert("A comment is required to reject");
      return;
    }
    setProcessingId(id);
    try {
      await reviewSubmission(id, "rejected", comment);
      setRejectingId(null);
      setComment("");
      loadSubmissions();
    } catch (err) {
      alert(err.message || "Failed to reject");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;
  }

  const pending = submissions.filter((s) => s.status === "pending");

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Review Submissions</h1>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>Approve or reject task proofs</p>

      {pending.length === 0 ? (
        <p style={{ color: "#94a3b8", textAlign: "center" }}>No pending submissions</p>
      ) : (
        pending.map((sub) => (
          <div key={sub.id} className="wallet-card" style={{ marginBottom: 12 }}>
            <h2>{sub.tasks?.title}</h2>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              User: {sub.users?.username || sub.users?.telegram_id}
            </p>
            <p style={{ color: "#4ade80", fontWeight: "bold" }}>
              ${Number(sub.tasks?.reward_amount ?? 0).toFixed(2)}
            </p>
            <div style={{ background: "#0f172a", borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 12 }}>
              <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>Proof link (tap to open):</p>
              <a
                href={sub.proof_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ wordBreak: "break-all", fontSize: 15, color: "#60a5fa", fontWeight: "bold", textDecoration: "underline" }}
              >
                {sub.proof_link}
              </a>
            </div>

            {rejectingId === sub.id ? (
              <div>
                <textarea
                  placeholder="Reason for rejection (required)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="wallet-input"
                  style={{ minHeight: 60 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="wallet-btn"
                    onClick={() => handleReject(sub.id)}
                    disabled={processingId === sub.id}
                    style={{ background: "#7f1d1d" }}
                  >
                    Confirm Reject
                  </button>
                  <button
                    className="wallet-btn"
                    onClick={() => { setRejectingId(null); setComment(""); }}
                    style={{ background: "#334155" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  className="wallet-btn"
                  onClick={() => handleApprove(sub.id)}
                  disabled={processingId === sub.id}
                  style={{ background: "#166534" }}
                >
                  Approve
                </button>
                <button
                  className="wallet-btn"
                  onClick={() => setRejectingId(sub.id)}
                  style={{ background: "#7f1d1d" }}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
