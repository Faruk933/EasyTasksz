import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loginWithTelegram } from "../telegramAuth";
import { startLaunchAd, watchAdAndReward } from "../rewardAds";
import { getPublicSettings } from "../publicSettings";
import { mySubmissions } from "../tasks";
import "./Dashboard.css";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [adMessage, setAdMessage] = useState(null);
  const [settings, setSettings] = useState({});
  const [pendingAmount, setPendingAmount] = useState(0);

  async function loadPendingAmount() {
    try {
      const submissions = await mySubmissions();
      const total = (submissions || [])
        .filter((submission) => submission.status === "pending")
        .reduce((sum, submission) => sum + Number(submission.tasks?.reward_amount || 0), 0);
      setPendingAmount(total);
    } catch (err) {
      console.error("Pending task rewards:", err);
      setPendingAmount(0);
    }
  }

  useEffect(() => {
    loginWithTelegram().then(async (u) => {
      if (!u) {
        setError("Could not load Telegram user. Open this app from your Telegram bot.");
        return;
      }
      setUser(u);
      await loadPendingAmount();

      const publicSettings = await getPublicSettings().catch(() => ({}));
      setSettings(publicSettings || {});
      if (String(publicSettings?.launch_ad_enabled).toLowerCase() === "true") {
        startLaunchAd();
      }
    }).catch((err) => {
      console.error(err);
      setError("Something went wrong loading your profile.");
    }).finally(() => setLoading(false));
  }, []);

  async function handleWatchAd() {
    setAdMessage(null);
    setAdLoading(true);
    try {
      const updatedUser = await watchAdAndReward();
      setUser(updatedUser);
      setAdMessage("🎉 Reward added!");
    } catch (err) {
      setAdMessage(err.message || "Could not complete ad.");
    } finally {
      setAdLoading(false);
    }
  }

  if (loading) return <div className="dashboard-loading">Loading...</div>;
  if (error) return <div className="dashboard-error">{error}</div>;

  const adsWatched = user?.ads_watched_today ?? 0;
  const adLimit = Number(settings.daily_ad_limit ?? 20);
  const progress = Math.min(100, adLimit ? (adsWatched / adLimit) * 100 : 0);
  const earned = Number(user?.total_earned ?? 0);
  const displayBalance = Number(user?.balance ?? 0).toString();
  const displayEarned = earned.toString();
  const displayPending = pendingAmount.toString();
  const level = earned >= 100 ? 3 : earned >= 25 ? 2 : 1;
  const levelName = level === 3 ? "Expert" : level === 2 ? "Rising" : "Newbie";

  return (
    <div className="dashboard-modern">
      <div className="dash-grid-glow" />
      <header className="dash-profile">
        <div className="dash-avatar-wrap">
          {user?.photo_url ? <img src={user.photo_url} alt="avatar" className="dash-avatar" /> : <div className="dash-avatar dash-avatar-fallback">✓</div>}
          <span className="dash-level-dot" />
        </div>
        <div className="dash-profile-info">
          <h2>{user?.first_name || "Welcome"}</h2>
          <div className="dash-level-row"><span>LV.{level}</span><i><b style={{ width: `${Math.min(100, earned * 2)}%` }} /></i><strong>{levelName}</strong></div>
        </div>
        <div className="dash-globe">◎</div>
      </header>

      <section className="dash-balance-grid">
        <div className="dash-balance-card dash-green"><strong>${displayBalance}</strong><span>Current Balance</span></div>
        <div className="dash-balance-card dash-gold"><strong>{displayEarned}</strong><span>Total Earned</span></div>
        <div className="dash-balance-card dash-orange"><strong>${displayPending}</strong><span>Pending</span></div>
      </section>

      <section className="dash-checkin">
        <div><b>Daily Earning</b><small>Watch ads every day to build your earnings</small></div>
        <div className="dash-checkin-progress"><span>{adsWatched}/{adLimit}</span><i><b style={{ width: `${progress}%` }} /></i></div>
      </section>

      <button className="dash-watch" onClick={handleWatchAd} disabled={adLoading}>
        <span className="dash-watch-icon">▶</span><span><b>{adLoading ? "LOADING AD..." : "WATCH & EARN"}</b><small>Watch ads for instant rewards</small></span><strong>›</strong>
      </button>
      {adMessage && <div className="dash-message">{adMessage}</div>}

      <div className="dash-section-title"><span>🔥</span> MORE WAYS TO EARN</div>
      <Link to="/tasks" className="dash-task-card"><div className="dash-task-icon task-blue">✓</div><div className="dash-task-info"><b>Complete Tasks</b><small>Finish simple tasks for rewards</small><span>💰 Earn rewards</span></div><button>START</button></Link>
      <Link to="/offerwall" className="dash-task-card"><div className="dash-task-icon task-orange">⚡</div><div className="dash-task-info"><b>Offerwall</b><small>Surveys, apps & offers</small><span>💰 More ways to earn</span></div><button>START</button></Link>
    </div>
  );
}
