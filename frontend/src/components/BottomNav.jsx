import { NavLink } from "react-router-dom";
import { Home, PlayCircle, Users, Wallet, User } from "lucide-react";
import "./BottomNav.css";

export default function BottomNav() {
  return (
    <div className="bottom-nav">
      <NavLink to="/" end className="nav-item">
        <Home size={22} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/ads" className="nav-item">
        <PlayCircle size={22} />
        <span>Ads</span>
      </NavLink>
      <NavLink to="/referrals" className="nav-item">
        <Users size={22} />
        <span>Friends</span>
      </NavLink>
      <NavLink to="/wallet" className="nav-item">
        <Wallet size={22} />
        <span>Wallet</span>
      </NavLink>
      <NavLink to="/profile" className="nav-item">
        <User size={22} />
        <span>Profile</span>
      </NavLink>
    </div>
  );
}
