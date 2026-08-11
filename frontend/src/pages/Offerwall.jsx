import { useNavigate } from "react-router-dom";
import "./Offerwall.css";

const providers = [
  {
    name: "CPAlead",
    desc: "Complete offers & surveys",
    color: "#3b82f6",
    initial: "C",
    url: "https://cpalead.com",
    active: true,
  },
  {
    name: "AdGate (BitLabs)",
    desc: "Surveys, apps & tasks",
    color: "#8b5cf6",
    initial: "A",
    url: "https://adgatemedia.com",
    active: true,
  },
  {
    name: "Lootably",
    desc: "Coming soon",
    color: "#64748b",
    initial: "L",
    url: null,
    active: false,
  },
  {
    name: "Ayet Studios",
    desc: "Coming soon",
    color: "#64748b",
    initial: "A",
    url: null,
    active: false,
  },
  {
    name: "PixyLabs",
    desc: "Offers, surveys & more",
    color: "#16a34a",
    initial: "P",
    type: "iframe",
    route: "/offerwall/pixylabs",
    active: true,
  },
];

export default function Offerwall() {
  const navigate = useNavigate();

  function handleOpen(provider) {
    if (!provider.active) return;
    if (provider.type === "iframe") {
      navigate(provider.route);
      return;
    }
    if (!provider.url) return;
    window.open(provider.url, "_blank");
  }

  return (
    <div style={{ padding: 16 }}>
      <div className="offerwall-header">
        <h1>🎁 Offerwall</h1>
        <p>Complete offers and surveys to earn more</p>
      </div>

      {providers.map((provider) => (
        <div className="provider-card" key={provider.name}>
          <div className="provider-info">
            <div className="provider-icon" style={{ background: provider.color }}>
              {provider.initial}
            </div>
            <div>
              <p className="provider-name">{provider.name}</p>
              <p className="provider-desc">{provider.desc}</p>
            </div>
          </div>
          <button
            className={`provider-btn ${provider.active ? "" : "disabled"}`}
            onClick={() => handleOpen(provider)}
            disabled={!provider.active}
          >
            {provider.active ? "Open" : "Soon"}
          </button>
        </div>
      ))}
    </div>
  );
}
