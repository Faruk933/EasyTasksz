import { useEffect, useState } from "react";
import { loginWithTelegram } from "../telegramAuth";

export default function CPAleadOfferwall() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loginWithTelegram()
      .then((u) => {
        if (u) {
          setUser(u);
        } else {
          setError("Could not load Telegram user. Open this app from your Telegram bot.");
        }
      })
      .catch(() => setError("Something went wrong loading the offerwall."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: 16, color: "#f87171" }}>{error}</div>;
  }

  const iframeUrl = `https://www.qckclk.com/wall/sreL?subid=${user.telegram_id}`;

  return (
    <iframe
      src={iframeUrl}
      title="CPAlead Offerwall"
      sandbox="allow-popups allow-same-origin allow-scripts allow-forms allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
