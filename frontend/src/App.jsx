import { Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import WatchAds from "./pages/WatchAds";
import Referrals from "./pages/Referrals";
import Wallet from "./pages/Wallet";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Offerwall from "./pages/Offerwall";
import Admin from "./pages/Admin";

import Header from "./components/Header";
import BottomNav from "./components/BottomNav";

export default function App() {
  return (
    <div style={{ paddingBottom: 70 }}>
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ads" element={<WatchAds />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/offerwall" element={<Offerwall />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
