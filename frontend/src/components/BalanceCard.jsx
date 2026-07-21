export default function BalanceCard({ balance }) {
  return (
    <div className="balance-card">
      <p>Current Balance</p>
      <h2>${Number(balance ?? 0).toFixed(2)}</h2>
      <small>Ready for withdrawal</small>
    </div>
  );
}
