import { useNavigate } from "react-router-dom";
import "./Offerwall.css";

const providers = [
  { name: "CPAlead", desc: "Complete offers & surveys", logo: "https://www.cpalead.com/favicon.ico", route: "/offerwall/cpalead" },
  { name: "BitLabs", desc: "Surveys, apps & tasks", logo: "https://asset.brandfetch.io/idi22fXdIo/idCFcmsQ1.jpeg?updated=1702319304608", route: "/offerwall/bitlabs", crop: true },
  { name: "PixyLabs", desc: "Offers, surveys & more", logo: "https://www.google.com/s2/favicons?domain=pixylabs.co&sz=128", route: "/offerwall/pixylabs" },
  { name: "TimeWall", desc: "Microtasks, surveys & offers", logo: "https://timewall.io/favicon.ico", route: "/offerwall/timewall" },
];

export default function Offerwall() {
  const navigate = useNavigate();
  return <div className="offerwall-page">
    <div className="offerwall-header"><h1>🎁 Offerwall</h1><p>Complete offers and surveys to earn more</p></div>
    {providers.map((provider) => <div className="provider-card" key={provider.name}>
      <div className="provider-info">
        <div className={`provider-icon provider-logo${provider.crop ? " provider-logo-crop" : ""}`}>
          <img
            src={provider.logo}
            alt={`${provider.name} logo`}
            onError={(e) => {
              if (provider.name === "PixyLabs") {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) fallback.style.display = "grid";
              }
            }}
          />
          {provider.name === "PixyLabs" && (
            <span
              aria-hidden="true"
              style={{
                display: "none",
                width: "100%",
                height: "100%",
                placeItems: "center",
                borderRadius: "inherit",
                background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
              }}
            >PL</span>
          )}
        </div>
        <div><p className="provider-name">{provider.name}</p><p className="provider-desc">{provider.desc}</p></div>
      </div>
      <button className="provider-btn" onClick={()=>navigate(provider.route)}>Open</button>
    </div>)}
  </div>;
}
