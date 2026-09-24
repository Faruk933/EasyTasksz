export async function loginWithTelegram() {
  const tg = window.Telegram?.WebApp;

  if (!tg) {
    console.warn("Not running inside Telegram");
    throw new Error("TELEGRAM_WEBAPP_MISSING");
  }

  tg.ready();
  const initData = tg.initData;

  if (!initData) {
    console.warn("No initData available");
    throw new Error("TELEGRAM_INITDATA_MISSING");
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
    if (response.status === 403 && result?.error === "ACCOUNT_BANNED") {
      try {
        tg.showPopup?.({
          title: "Account banned",
          message: result.message || "Your EasyTasksz account has been banned.",
          buttons: [{ type: "ok" }],
        });
      } catch {}
      throw new Error("ACCOUNT_BANNED");
    }
    console.error("Auth failed:", result);
    throw new Error(result?.error || "TELEGRAM_AUTH_FAILED");
  }

  return result.user;
}
