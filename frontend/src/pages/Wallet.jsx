import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";
import { requestWithdrawal } from "../withdraw";
import { getPublicSettings } from "../publicSettings";
import "./Wallet.css";

const SOL_NETWORK_FEE = 0.00005;
const DEFAULT_WITHDRAWAL_FEE_PERCENT = 0.1;
const SOL_PRICE_CACHE_KEY = "easytasksz_sol_usd_price";
const SOL_PRICE_CACHE_TTL = 60 * 1000;

function readCachedSolPrice() {
  try {
    const cached = JSON.parse(localStorage.getItem(SOL_PRICE_CACHE_KEY) || "null");
    if (cached && Number.isFinite(Number(cached.price)) && Number(cached.price) > 0 && Date.now() - Number(cached.timestamp) < SOL_PRICE_CACHE_TTL) return Number(cached.price);
  } catch (_) {}
  return null;
}

function cacheSolPrice(price) {
  try { localStorage.setItem(SOL_PRICE_CACHE_KEY, JSON.stringify({ price, timestamp: Date.now() })); } catch (_) {}
}

export default function Wallet() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState({});
  const [solPrice, setSolPrice] = useState(() => readCachedSolPrice());
  const [solPriceLoading, setSolPriceLoading] = useState(() => !readCachedSolPrice());

  useEffect(() => {
    getPublicSettings().then(setSettings).catch(() => {});

    const loadSolPrice = async () => {
      const cached = readCachedSolPrice();
      if (cached) {
        setSolPrice(cached);
        setSolPriceLoading(false);
      } else setSolPriceLoading(true);

      const fetchPrice = async (url, parser) => {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) return null;
          const data = await response.json();
          const price = Number(parser(data));
          return Number.isFinite(price) && price > 0 ? price : null;
        } catch (_) { return null; }
      };

      const sources = [
        fetchPrice("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", (data) => data?.price),
        fetchPrice("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", (data) => data?.solana?.usd),
      ];

      try {
        const price = await Promise.any(sources);
        setSolPrice(price);
        cacheSolPrice(price);
      } catch (_) {
        // No usable live price; keep CALCULATING and keep withdrawal hidden.
      } finally {
        setSolPriceLoading(false);
      }
    };

    loadSolPrice();

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
    if (!walletAddress) { setSubmitMessage("Please enter your Solana wallet address"); return; }
    const minWithdrawal = Number(settings.minimum_withdrawal ?? 10);
    const withdrawalAmount = Number(amount);
    if (!Number.isFinite(withdrawalAmount) || withdrawalAmount < minWithdrawal) { setSubmitMessage(`Minimum withdrawal is $${minWithdrawal}`); return; }
    if (withdrawalAmount > Number(user?.balance ?? 0)) { setSubmitMessage("Withdrawal amount exceeds your balance"); return; }

    setSubmitting(true);
    try {
      const result = await requestWithdrawal(walletAddress, withdrawalAmount);
      setUser((prev) => ({ ...prev, balance: result.newBalance }));
      setSubmitMessage(`✅ Withdrawal submitted: ${Number(result.payoutSol).toFixed(8)} SOL`);
      setWalletAddress("");
      setAmount("");
    } catch (err) {
      setSubmitMessage(err.message || "Withdrawal failed");
    } finally { setSubmitting(false); }
  }

  const selectedAmount = Number(amount || 0);
  const rawFeePercent = Number(settings.withdrawal_fee_percent);
  const feePercent = Number.isFinite(rawFeePercent) && rawFeePercent >= 0 ? rawFeePercent : DEFAULT_WITHDRAWAL_FEE_PERCENT;
  const platformFee = selectedAmount * (feePercent / 100);
  const calculating = selectedAmount > 0 && (solPriceLoading || !Number.isFinite(solPrice) || solPrice <= 0);
  const calculated = selectedAmount > 0 && !calculating;
  const networkFeeUsd = calculated ? SOL_NETWORK_FEE * solPrice : null;
  const totalFeesUsd = calculated ? platformFee + networkFeeUsd : null;
  const estimatedPayoutUsd = calculated ? Math.max(0, selectedAmount - platformFee - networkFeeUsd) : null;
  const estimatedSol = calculated ? Math.max(0, estimatedPayoutUsd / solPrice) : null;
  const displayBalance = Number(user?.balance ?? 0).toString();

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (error) return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>💰 Wallet</h1>
      <p style={{ color: "#94a3b8", marginBottom: 16 }}>View your balance and withdraw</p>

      <div className="wallet-card">
        <h2>Available Balance</h2>
        <p className="wallet-balance">${displayBalance}</p>
      </div>

      <div className="wallet-card">
        <h2>Request Withdrawal</h2>
        <input type="text" placeholder="Solana Wallet Address" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="wallet-input" />
        <input type="number" min="0" step="0.01" placeholder="Amount (USD)" value={amount} onChange={(e) => setAmount(e.target.value)} className="wallet-input" />

        {selectedAmount > 0 && (
          <div className="wallet-fee-breakdown">
            <div><span>Platform fee ({feePercent}%)</span><strong>{calculating ? "CALCULATING" : `$${platformFee.toFixed(2)} USD`}</strong></div>
            <div><span>Network fee</span><strong>{calculating ? "CALCULATING" : `${SOL_NETWORK_FEE} SOL (~$${networkFeeUsd.toFixed(4)})`}</strong></div>
            <div><span>Total fees</span><strong>{calculating ? "CALCULATING" : `$${totalFeesUsd.toFixed(4)} USD`}</strong></div>
            <div className="wallet-payout-row"><span>You receive</span><strong>{calculating ? "CALCULATING" : `${estimatedSol.toFixed(8)} SOL (~$${estimatedPayoutUsd.toFixed(4)})`}</strong></div>
            {!calculating && <div><span>Current SOL rate</span><strong>${solPrice.toFixed(2)} / SOL</strong></div>}
          </div>
        )}

        {selectedAmount > 0 && calculated && <button className="wallet-btn" onClick={handleWithdraw} disabled={submitting}>{submitting ? "Submitting..." : "Withdraw"}</button>}
        <p className="wallet-note">Minimum withdrawal: ${settings.minimum_withdrawal ?? 10} USD</p>
        <p className="wallet-note">Withdrawals are paid in native SOL on the Solana network. Your USD wallet balance is converted to SOL using the live SOL/USDT rate when the request is submitted.</p>
        {submitMessage && <p className="wallet-note" style={{ color: "#facc15" }}>{submitMessage}</p>}
      </div>

      <Link to="/history" style={{ textDecoration: "none" }}><div className="wallet-card"><h2>Withdrawal History</h2><p className="wallet-empty">View all your withdrawals →</p></div></Link>
    </div>
  );
}
