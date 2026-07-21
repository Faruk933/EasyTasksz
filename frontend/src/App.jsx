import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import Dashboard from "./pages/Dashboard";
import WatchAds from "./pages/WatchAds";
import Referrals from "./pages/Referrals";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <div style={{ paddingBottom: 70 }}>
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ads" element={<WatchAds />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
