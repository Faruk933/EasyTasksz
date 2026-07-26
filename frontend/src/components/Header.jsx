import { Bell, Check } from "lucide-react";
import "./Header.css";

export default function Header() {
  return (
    <div className="header">
      <div className="header-left">
        <div className="header-logo">
          <Check size={16} color="white" strokeWidth={3} />
        </div>
        <div>
          <h1 className="header-title">
            Easy<span className="header-title-accent">Tasksz</span>
          </h1>
          <p>Welcome back 👋</p>
        </div>
      </div>
      <div className="header-bell">
        <Bell size={22} />
      </div>
    </div>
  );
}
