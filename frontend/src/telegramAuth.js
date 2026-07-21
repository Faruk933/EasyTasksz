export async function loginWithTelegram() {
  const tg = window.Telegram?.WebApp;

  if (!tg) {
    console.warn("Not running inside Telegram");
    return null;
  }

  tg.ready();
  const initData = tg.initData;

  if (!initData) {
    console.warn("No initData available");
    return null;
  }

  const response = await fetch(
    "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/telegram-auth",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("Auth failed:", result);
    return null;
  }

  return result.user;
}
