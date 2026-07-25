export default function BalanceCard({ balance }) {
  return (
    <div className="balance-card">
      <div className="balance-card-top">
        <span className="balance-label">Current Balance</span>
        <span className="balance-badge">✓ Ready for withdrawal</span>
      </div>
      <h2 className="balance-amount">${Number(balance ?? 0).toFixed(2)}</h2>
      <span className="balance-subtitle">Available Funds</span>
    </div>
  );
}
