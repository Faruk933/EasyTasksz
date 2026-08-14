import { useNavigate } from "react-router-dom";
import "./Offerwall.css";

const providers = [
  { name: "CPAlead", desc: "Complete offers & surveys", logo: "https://www.cpalead.com/favicon.ico", type: "iframe", route: "/offerwall/cpalead", active: true },
  { name: "BitLabs", desc: "Surveys, apps & tasks", logo: "https://bitlabs.ai/favicon.ico", type: "iframe", route: "/offerwall/bitlabs", active: true },
  { name: "PixyLabs", desc: "Offers, surveys & more", logo: "https://www.pixylabs.co/favicon.ico", type: "iframe", route: "/offerwall/pixylabs", active: true },
];

export default function Offerwall() {
  const navigate = useNavigate();
  return <div style={{ padding: 16 }}>
    <div className="offerwall-header"><h1>🎁 Offerwall</h1><p>Complete offers and surveys to earn more</p></div>
    {providers.map((provider) => <div className="provider-card" key={provider.name}>
      <div className="provider-info">
        <div className="provider-icon provider-logo">
          <img src={provider.logo} alt={`${provider.name} logo`} onError={(e)=>{e.currentTarget.style.display="none";e.currentTarget.nextElementSibling.style.display="block"}} />
          <span className="provider-logo-fallback">{provider.name.charAt(0)}</span>
        </div>
        <div><p className="provider-name">{provider.name}</p><p className="provider-desc">{provider.desc}</p></div>
      </div>
      <button className="provider-btn" onClick={()=>navigate(provider.route)}>Open</button>
    </div>)}
  </div>;
}
