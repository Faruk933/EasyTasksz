import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";
import { requestWithdrawal } from "../withdraw";
import { getPublicSettings } from "../publicSettings";
import "./Wallet.css";

const SOL_NETWORK_FEE = 0.00005;

export default function Wallet() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState({});
  const [solPrice, setSolPrice] = useState(null);

  useEffect(() => {
    getPublicSettings().then(setSettings).catch(() => {});
    fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT")
      .then((r) => r.json())
      .then((d) => {
        const price = Number(d?.price);
        if (Number.isFinite(price) && price > 0) setSolPrice(price);
      })
      .catch(() => {});
    loginWithTelegram()
      .then((u) => {
        if (u) setUser(u);
        else setError("Could not load Telegram user. Open this app from your Telegram bot.");
      })
      .catch(() => setError("Something went wrong loading your wallet."))
      .finally(() => setLoading(false));
  }, []);

  async function handleWithdraw() {
    setSubmitMessage(null);
    if (!walletAddress) {
      setSubmitMessage("Please enter your Solana wallet address");
      return;
    }

    const minWithdrawal = Number(settings.minimum_withdrawal ?? 10);
    const withdrawalAmount = Number(amount);
    if (!Number.isFinite(withdrawalAmount) || withdrawalAmount < minWithdrawal) {
      setSubmitMessage(`Minimum withdrawal is $${minWithdrawal}`);
      return;
    }
    if (withdrawalAmount > Number(user?.balance ?? 0)) {
      setSubmitMessage("Withdrawal amount exceeds your balance");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestWithdrawal(walletAddress, withdrawalAmount);
      setUser((prev) => ({ ...prev, balance: result.newBalance }));
      setSubmitMessage(`✅ Withdrawal submitted: ${Number(result.payoutSol).toFixed(8)} SOL`);
      setWalletAddress("");
      setAmount("");
    } catch (err) {
      setSubmitMessage(err.message || "Withdrawal failed");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedAmount = Number(amount || 0);
  const feePercent = Number(settings.withdrawal_fee_percent ?? 0);
  const platformFee = selectedAmount * (feePercent / 100);
  const networkFeeUsd = solPrice ? SOL_NETWORK_FEE * solPrice : null;
  const totalFeesUsd = platformFee + (networkFeeUsd ?? 0);
  const estimatedPayoutUsd = Math.max(0, selectedAmount - totalFeesUsd);
  const estimatedSol = solPrice && estimatedPayoutUsd > 0 ? Math.max(0, estimatedPayoutUsd / solPrice - SOL_NETWORK_FEE) : null;

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>💰 Wallet</h1>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>View your balance and withdraw</p>

      <div className="wallet-card">
        <h2>Available Balance</h2>
        <p className="wallet-balance">${Number(user?.balance ?? 0).toFixed(2)} USD</p>
      </div>

      <div className="wallet-card">
        <h2>Request Withdrawal</h2>

        <input
          type="text"
          placeholder="Solana Wallet Address"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          className="wallet-input"
        />

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount (USD)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="wallet-input"
        />

        {selectedAmount > 0 && (
          <div className="wallet-fee-breakdown">
            <div><span>Platform fee ({feePercent}%)</span><strong>${platformFee.toFixed(2)} USD</strong></div>
            <div><span>Network fee</span><strong>{SOL_NETWORK_FEE} SOL{networkFeeUsd !== null ? ` (~$${networkFeeUsd.toFixed(4)})` : ""}</strong></div>
            <div><span>Total fees</span><strong>${totalFeesUsd.toFixed(2)} USD</strong></div>
            <div className="wallet-payout-row"><span>You receive</span><strong>{estimatedSol !== null ? `${estimatedSol.toFixed(8)} SOL` : "Calculating…"}</strong></div>
            {solPrice && <div><span>Current SOL rate</span><strong>${solPrice.toFixed(2)} / SOL</strong></div>}
          </div>
        )}

        <button className="wallet-btn" onClick={handleWithdraw} disabled={submitting}>
          {submitting ? "Submitting..." : "Withdraw"}
        </button>

        <p className="wallet-note">Minimum withdrawal: ${settings.minimum_withdrawal ?? 10} USD</p>
        <p className="wallet-note">Withdrawals are paid in native SOL on the Solana network. Your USD wallet balance is converted to SOL using the live SOL/USDT rate when the request is submitted.</p>

        {submitMessage && <p className="wallet-note" style={{ color: "#facc15" }}>{submitMessage}</p>}
      </div>

      <Link to="/history" style={{ textDecoration: "none" }}>
        <div className="wallet-card">
          <h2>Withdrawal History</h2>
          <p className="wallet-empty">View all your withdrawals →</p>
        </div>
      </Link>
    </div>
  );
}
