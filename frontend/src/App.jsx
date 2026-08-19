import { Routes, Route, useLocation } from "react-router-dom";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import WatchAds from "./pages/WatchAds";
import Referrals from "./pages/Referrals";
import Wallet from "./pages/Wallet";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Offerwall from "./pages/Offerwall";
import OfferwallMeOfferwall from "./pages/OfferwallMeOfferwall";
import PixyLabsOfferwall from "./pages/PixyLabsOfferwall";
import CPAleadOfferwall from "./pages/CPAleadOfferwall";
import BitLabsOfferwall from "./pages/BitLabsOfferwall";
import TimeWallOfferwall from "./pages/TimeWallOfferwall";
import BitcoTasksOfferwall from "./pages/BitcoTasksOfferwall";
import Admin from "./pages/Admin";
import AdminSettings from "./pages/AdminSettings";
import ReferralAnalytics from "./pages/ReferralAnalytics";
import AdminCampaigns from "./pages/AdminCampaigns";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import AdminTasks from "./pages/AdminTasks";
import AdminSubmissions from "./pages/AdminSubmissions";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";

export default function App(){
  const location=useLocation();
  const isImmersiveOfferwall=[
    "/offerwall/offerwallme",
    "/offerwall/pixylabs",
    "/offerwall/cpalead",
    "/offerwall/bitlabs",
    "/offerwall/timewall",
    "/offerwall/bitcotasks"
  ].includes(location.pathname);

  return (
    <div
      className={isImmersiveOfferwall?"app-content immersive":"app-content"}
      style={{paddingBottom:isImmersiveOfferwall?0:86}}
    >
      {!isImmersiveOfferwall&&<Header/>}
      <Routes>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/ads" element={<WatchAds/>}/>
        <Route path="/referrals" element={<Referrals/>}/>
        <Route path="/wallet" element={<Wallet/>}/>
        <Route path="/history" element={<History/>}/>
        <Route path="/profile" element={<Profile/>}/>
        <Route path="/offerwall" element={<Offerwall/>}/>
        <Route path="/offerwall/offerwallme" element={<OfferwallMeOfferwall/>}/>
        <Route path="/offerwall/pixylabs" element={<PixyLabsOfferwall/>}/>
        <Route path="/offerwall/cpalead" element={<CPAleadOfferwall/>}/>
        <Route path="/offerwall/bitlabs" element={<BitLabsOfferwall/>}/>
        <Route path="/offerwall/timewall" element={<TimeWallOfferwall/>}/>
        <Route path="/offerwall/bitcotasks" element={<BitcoTasksOfferwall/>}/>
        <Route path="/admin" element={<Admin/>}/>
        <Route path="/admin/campaigns" element={<AdminCampaigns/>}/>
        <Route path="/admin/settings" element={<AdminSettings/>}/>
        <Route path="/admin/referrals" element={<ReferralAnalytics/>}/>
        <Route path="/tasks" element={<Tasks/>}/>
        <Route path="/tasks/:id" element={<TaskDetail/>}/>
        <Route path="/admin/tasks" element={<AdminTasks/>}/>
        <Route path="/admin/submissions" element={<AdminSubmissions/>}/>
      </Routes>
      {!isImmersiveOfferwall&&<BottomNav/>}
    </div>
  );
}
