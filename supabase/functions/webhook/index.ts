const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")?.trim() || "";

function timingSafeEqualText(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    if (!WEBHOOK_SECRET || !timingSafeEqualText(req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "", WEBHOOK_SECRET)) return new Response("Unauthorized", { status: 401 });
    const update = await req.json();
    const message = update.message;

    if (!message || !message.text) {
      return new Response("ok");
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const referralCode = parts.length > 1 ? parts[1] : "";

      const webAppUrl = referralCode
        ? `https://easytasksz.pages.dev/?startapp=${referralCode}`
        : `https://easytasksz.pages.dev/`;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "👋 Welcome to EasyTasksz!\n\nTap below to start earning.",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🚀 Open EasyTasksz",
                  web_app: { url: webAppUrl },
                },
              ],
            ],
          },
        }),
      });
    }

    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("ok");
  }
});
