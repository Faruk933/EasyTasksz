import "./Offerwall.css";
import { useNavigate } from "react-router-dom";

const providers = [
  { name: "Offerwall.me", desc: "Microtasks, offers, shortlinks & PTC", logo: "/offerwallme-logo.jpg", route: "/offerwall/offerwallme" },
  { name: "BitcoTasks", desc: "Microtasks, offers, PTC & shortlinks", logo: "https://www.google.com/s2/favicons?domain=bitcotasks.com&sz=128", route: "/offerwall/bitcotasks" },
  { name: "CPAlead", desc: "Complete offers & surveys", logo: "https://www.cpalead.com/favicon.ico", route: "/offerwall/cpalead" },
  { name: "BitLabs", desc: "Surveys, apps & tasks", logo: "https://www.google.com/s2/favicons?domain=bitlabs.ai&sz=128", route: "/offerwall/bitlabs" },
  { name: "PixyLabs", desc: "Offers, surveys & more", logo: "https://pixylabs.co/favicon.ico", route: "/offerwall/pixylabs" },
  { name: "TimeWall", desc: "Microtasks, surveys & offers", logo: "https://timewall.io/favicon.ico", route: "/offerwall/timewall" },
];

export default function Offerwall() {
  const navigate = useNavigate();

  const handleLogoError = (event) => {
    const image = event.currentTarget;
    image.style.display = "none";
    const fallback = image.nextElementSibling;
    if (fallback) fallback.style.display = "grid";
  };

  return (
    <div className="offerwall-page">
      <div className="offerwall-header">
        <h1>🎁 Offerwall</h1>
        <p>Complete offers and microtasks to earn more</p>
      </div>

      {providers.map((provider) => (
        <div className="provider-card" key={provider.name}>
          <div className="provider-info">
            <div className="provider-icon provider-logo">
              <img src={provider.logo} alt={`${provider.name} logo`} onError={handleLogoError} />
              <span aria-hidden="true" style={{ display: "none", width: "100%", height: "100%", placeItems: "center", borderRadius: "inherit", background: provider.name === "BitLabs" ? "#111827" : "linear-gradient(135deg,#0ea5e9,#14b8a6)", color: "#fff", fontWeight: 800, fontSize: 14 }}>
                {provider.name === "Offerwall.me" ? "OW" : provider.name === "BitcoTasks" ? "BT" : provider.name === "BitLabs" ? "BL" : provider.name === "PixyLabs" ? "PL" : provider.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="provider-name">{provider.name}</p>
              <p className="provider-desc">{provider.desc}</p>
            </div>
          </div>
          <button className="provider-btn" onClick={() => navigate(provider.route)}>Open</button>
        </div>
      ))}
    </div>
  );
}
