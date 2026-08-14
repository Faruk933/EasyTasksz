import { Routes, Route, useLocation } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import WatchAds from "./pages/WatchAds";
import Referrals from "./pages/Referrals";
import Wallet from "./pages/Wallet";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Offerwall from "./pages/Offerwall";
import PixyLabsOfferwall from "./pages/PixyLabsOfferwall";
import CPAleadOfferwall from "./pages/CPAleadOfferwall";
import Admin from "./pages/Admin";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import AdminTasks from "./pages/AdminTasks";
import AdminSubmissions from "./pages/AdminSubmissions";

import Header from "./components/Header";
import BottomNav from "./components/BottomNav";

export default function App() {
  const location = useLocation();
  const isImmersiveOfferwall =
    location.pathname === "/offerwall/pixylabs" ||
    location.pathname === "/offerwall/cpalead";

  return (
    <div style={{ paddingBottom: isImmersiveOfferwall ? 0 : 70 }}>
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ads" element={<WatchAds />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/offerwall" element={<Offerwall />} />
        <Route path="/offerwall/pixylabs" element={<PixyLabsOfferwall />} />
        <Route path="/offerwall/cpalead" element={<CPAleadOfferwall />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/admin/tasks" element={<AdminTasks />} />
        <Route path="/admin/submissions" element={<AdminSubmissions />} />
      </Routes>
      {!isImmersiveOfferwall && <BottomNav />}
    </div>
  );
}
