const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

Deno.serve(async (req) => {
  try {
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
        ? `https://easytasksz.netlify.app?startapp=${referralCode}`
        : `https://easytasksz.netlify.app`;

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
