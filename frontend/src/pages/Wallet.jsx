import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";
import { requestWithdrawal } from "../withdraw";
import { getPublicSettings } from "../publicSettings";
import "./Wallet.css";

const OXAPAY_NETWORK_FEE = 0.25;

export default function Wallet() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    getPublicSettings().then(setSettings).catch(() => {});
    loginWithTelegram()
      .then((u) => {
        if (u) {
          setUser(u);
        } else {
          setError("Could not load Telegram user. Open this app from your Telegram bot.");
        }
      })
      .catch(() => setError("Something went wrong loading your wallet."))
      .finally(() => setLoading(false));
  }, []);

  async function handleWithdraw() {
    setSubmitMessage(null);

    if (!walletAddress) {
      setSubmitMessage("Please enter your USDT BEP20 wallet address");
      return;
    }

    const minWithdrawal = Number(settings.minimum_withdrawal ?? 10);
    if (!amount || Number(amount) < minWithdrawal) {
      setSubmitMessage(`Minimum withdrawal is $${minWithdrawal} USDT`);
      return;
    }

    if (Number(amount) > Number(user?.balance ?? 0)) {
      setSubmitMessage("Withdrawal amount exceeds your balance");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestWithdrawal(walletAddress, Number(amount));
      setUser((prev) => ({ ...prev, balance: result.newBalance }));
      setSubmitMessage("✅ Withdrawal request submitted!");
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
  const estimatedPayout = Math.max(0, selectedAmount - platformFee - OXAPAY_NETWORK_FEE);

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>💰 Wallet</h1>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>
        View your balance and withdraw
      </p>

      <div className="wallet-card">
        <h2>Available Balance</h2>
        <p className="wallet-balance">
          ${Number(user?.balance ?? 0).toFixed(2)} USDT
        </p>
      </div>

      <div className="wallet-card">
        <h2>Request Withdrawal</h2>

        <input
          type="text"
          placeholder="USDT BEP20 Wallet Address"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          className="wallet-input"
        />

        <input
          type="number"
          placeholder="Amount (USDT)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="wallet-input"
        />

        <button className="wallet-btn" onClick={handleWithdraw} disabled={submitting}>
          {submitting ? "Submitting..." : "Withdraw"}
        </button>

        <p className="wallet-note">
          Minimum withdrawal: ${settings.minimum_withdrawal ?? 10} USDT (BEP20)
        </p>

        <p className="wallet-note">
          A {feePercent}% platform withdrawal fee applies, plus a flat $0.25 USDT BEP20 network fee. You will receive approximately ${estimatedPayout.toFixed(2)} USDT.
        </p>

        {submitMessage && (
          <p className="wallet-note" style={{ color: "#facc15" }}>
            {submitMessage}
          </p>
        )}
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
