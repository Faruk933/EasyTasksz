const telegramWebApp = window.Telegram?.WebApp;

if (telegramWebApp) {
  telegramWebApp.ready();
  telegramWebApp.expand();
  console.log("Telegram Mini App Ready");
}
