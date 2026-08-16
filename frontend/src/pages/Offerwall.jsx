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
              const img = e.currentTarget;
              if (provider.name === "PixyLabs") {
                img.onerror = null;
                img.style.display = "none";
                img.parentElement.classList.add("pixylabs-logo-fallback");
                img.parentElement.setAttribute("data-logo", "PL");
              }
            }}
          />
        </div>
        <div><p className="provider-name">{provider.name}</p><p className="provider-desc">{provider.desc}</p></div>
      </div>
      <button className="provider-btn" onClick={()=>navigate(provider.route)}>Open</button>
    </div>)}
  </div>;
}
