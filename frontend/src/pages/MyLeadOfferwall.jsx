import { useEffect, useMemo, useState } from "react";

const BASE_URL = "https://reward-me.eu/bec06414-9d59-11f1-bf69-8a5fb7be40ea";

export default function MyLeadOfferwall() {
  const [playerId, setPlayerId] = useState("");

  useEffect(() => {
    const id = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (id) setPlayerId(String(id));
  }, []);

  const offerwallUrl = useMemo(() => {
    if (!playerId) return "";
    const url = new URL(BASE_URL);
    url.searchParams.set("player_id", playerId);
    url.searchParams.set("ml_sub1", "easytasksz");
    return url.toString();
  }, [playerId]);

  if (!offerwallUrl) {
    return <div style={{ padding: 16, color: "#cbd5e1" }}>Open EasyTasksz inside Telegram to use the MyLead Offerwall.</div>;
  }

  return (
    <div style={{ width: "100vw", minHeight: "100vh", background: "#0f172a" }}>
      <iframe
        title="MyLead Offerwall"
        src={offerwallUrl}
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
        allow="autoplay; clipboard-write; encrypted-media"
      />
    </div>
  );
}
