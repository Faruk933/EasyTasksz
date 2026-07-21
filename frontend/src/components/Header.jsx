import { Bell } from "lucide-react";
import "./Header.css";

export default function Header() {
  return (
    <div className="header">
      <div>
        <h1>EasyTasksz</h1>
        <p>Welcome back 👋</p>
      </div>
      <Bell size={24} />
    </div>
  );
}
