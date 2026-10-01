const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")?.trim() || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASHNA_API_KEY = Deno.env.get("ASHNA_API_KEY")?.trim() || "";
const ASHNA_MODEL = Deno.env.get("ASHNA_SUPPORT_MODEL")?.trim() || "gpt-4o-mini";

const SUPPORT_MINUTES = 30;
const MAX_MESSAGES_PER_SESSION = 20;
const MAX_HISTORY_MESSAGES = 12;
const MAX_USER_MESSAGE_LENGTH = 1000;
const MAX_REPLY_LENGTH = 3500;

const SUPPORT_SYSTEM = `You are the EasyTasksz support assistant on Telegram.
Help users understand and use EasyTasksz: tasks, offer tasks, rewards, referrals, withdrawals, and general app usage.
Be concise, friendly, and factual.
You do NOT have access to private account balances, transaction records, withdrawal status, Telegram authentication data, or admin controls.
Never ask for passwords, bot tokens, API keys, Telegram login codes, or other secrets.
Never tell a user that a reward, withdrawal, or conversion has been completed unless the user provides that information.
If a question requires checking or changing an account, explain that the support assistant cannot perform that action and direct the user to the EasyTasksz app or human support.
Do not invent policies, task availability, rewards, or processing times.
If the user reports a missing offer reward, explain that provider confirmation/postback is required and that support may need to investigate.
Do not provide instructions for bypassing fraud checks, VPN/proxy restrictions, task requirements, or security controls.`;

function timingSafeEqualText(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function telegram(method: string, body: Record<string, unknown>) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function db(path: string, init: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function getSession(telegramId: number) {
  const response = await db(
    `support_sessions?telegram_id=eq.${encodeURIComponent(String(telegramId))}&select=telegram_id,active_until,history,message_count`,
    { method: "GET" },
  );
  if (!response.ok) throw new Error("Failed to read support session");
  const rows = await response.json();
  return rows[0] || null;
}

async function startSession(telegramId: number) {
  const activeUntil = new Date(Date.now() + SUPPORT_MINUTES * 60_000).toISOString();
  await db("support_sessions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      telegram_id: telegramId,
      active_until: activeUntil,
      history: [],
      message_count: 0,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function endSession(telegramId: number) {
  await db(`support_sessions?telegram_id=eq.${encodeURIComponent(String(telegramId))}`, { method: "DELETE" });
}

async function saveSession(telegramId: number, history: Array<{ role: string; content: string }>, count: number) {
  const activeUntil = new Date(Date.now() + SUPPORT_MINUTES * 60_000).toISOString();
  const trimmed = history.slice(-MAX_HISTORY_MESSAGES);
  const response = await db(`support_sessions?telegram_id=eq.${encodeURIComponent(String(telegramId))}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      active_until: activeUntil,
      history: trimmed,
      message_count: count,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error("Failed to save support session");
}

async function askAshna(history: Array<{ role: string; content: string }>) {
  if (!ASHNA_API_KEY) throw new Error("Support AI is not configured");

  const response = await fetch("https://api.ashna.ai/v1/api/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ASHNA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ASHNA_MODEL,
      messages: [{ role: "system", content: SUPPORT_SYSTEM }, ...history],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Ashna API error", response.status, data?.error?.message || "unknown");
    throw new Error("Support AI request failed");
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) throw new Error("Support AI returned no answer");
  return answer.trim().slice(0, MAX_REPLY_LENGTH);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    if (
      !WEBHOOK_SECRET ||
      !timingSafeEqualText(
        req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "",
        WEBHOOK_SECRET,
      )
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const update = await req.json();
    const message = update.message;
    if (!message || !message.text) return new Response("ok");

    const chatId = Number(message.chat?.id);
    const text = String(message.text).trim();
    if (!Number.isSafeInteger(chatId)) return new Response("ok");

    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
      const parts = text.split(/\s+/);
      const referralCode = parts.length > 1 ? parts[1] : "";
      const webAppUrl = referralCode
        ? `https://easytasksz.pages.dev/?startapp=${encodeURIComponent(referralCode)}`
        : "https://easytasksz.pages.dev/";

      await telegram("sendMessage", {
        chat_id: chatId,
        text: "👋 Welcome to EasyTasksz!\\n\\nTap below to start earning.\\n\\nNeed help? Use /support.",
        reply_markup: {
          inline_keyboard: [[{ text: "🚀 Open EasyTasksz", web_app: { url: webAppUrl } }]],
        },
      });
      return new Response("ok");
    }

    if (/^\/support(?:@\w+)?$/i.test(text)) {
      await startSession(chatId);
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "🤖 EasyTasksz Support is ready. Ask me your question.\\n\\nThis support session stays active for 30 minutes. Use /stop to end it.",
      });
      return new Response("ok");
    }

    if (/^\/stop(?:@\w+)?$/i.test(text)) {
      await endSession(chatId);
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Support chat ended. Use /support whenever you need help again.",
      });
      return new Response("ok");
    }

    const session = await getSession(chatId);
    if (!session || new Date(session.active_until).getTime() <= Date.now()) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Use /support to start an EasyTasksz support chat.",
      });
      return new Response("ok");
    }

    if (text.length === 0 || text.length > MAX_USER_MESSAGE_LENGTH) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: `Please keep your support message under ${MAX_USER_MESSAGE_LENGTH} characters.`,
      });
      return new Response("ok");
    }

    const count = Number(session.message_count || 0);
    if (count >= MAX_MESSAGES_PER_SESSION) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "This support session has reached its message limit. Use /support to start a new session.",
      });
      return new Response("ok");
    }

    const previousHistory = Array.isArray(session.history) ? session.history : [];
    const history = [
      ...previousHistory,
      { role: "user", content: text },
    ].slice(-MAX_HISTORY_MESSAGES);

    let answer: string;
    try {
      answer = await askAshna(history);
    } catch (error) {
      console.error(error);
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Sorry, support AI is temporarily unavailable. Please try again shortly.",
      });
      return new Response("ok");
    }

    const updatedHistory = [...history, { role: "assistant", content: answer }].slice(-MAX_HISTORY_MESSAGES);
    await saveSession(chatId, updatedHistory, count + 1);

    await telegram("sendMessage", {
      chat_id: chatId,
      text: answer,
    });

    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("ok");
  }
});
