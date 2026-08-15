import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listUsers } from "../admin";

export default function ReferralAnalytics() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listUsers("")
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Loading referral analytics...</div>;

  const ranked = [...users].sort((a, b) => Number(b.referral_count || 0) - Number(a.referral_count || 0));
  const totalReferrals = users.reduce((sum, u) => sum + Number(u.referral_count || 0), 0);

  return (
    <div style={{ padding: 16 }}>
      <Link to="/admin" style={{ color: "#60a5fa", textDecoration: "none" }}>← Admin Panel</Link>
      <h1>Referral Analytics</h1>
      <p style={{ color: "#94a3b8" }}>Referral performance and top referrers.</p>

      <div style={{ background: "#1e293b", borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>Tracked Referrals</div>
        <div style={{ fontSize: 28, fontWeight: "bold" }}>{totalReferrals}</div>
      </div>

      <h2 style={{ fontSize: 18 }}>Top Referrers</h2>
      {ranked.map((u, index) => (
        <div key={u.id} style={{ background: "#1e293b", borderRadius: 12, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <span>#{index + 1} @{u.username || u.telegram_id}</span>
          <strong>{Number(u.referral_count || 0)} referrals</strong>
        </div>
      ))}
    </div>
  );
}
