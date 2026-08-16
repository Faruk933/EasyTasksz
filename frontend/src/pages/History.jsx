import { useEffect, useState } from "react";
import { fetchHistory } from "../getHistory";
import "./History.css";

export default function History() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHistory()
      .then(setWithdrawals)
      .catch((err) => setError(err.message || "Could not load history"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>📜 History</h1>
      {withdrawals.length === 0 ? (
        <p className="history-empty">No withdrawals yet</p>
      ) : (
        withdrawals.map((w) => (
          <div className="history-item" key={w.id}>
            <div className="history-info">
              <p>Withdrawal to {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-4)}</p>
              <span>{new Date(w.created_at).toLocaleDateString()}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="history-amount">${Number(w.amount).toString()}</div>
              <div className={`history-status status-${w.status}`}>{w.status}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
