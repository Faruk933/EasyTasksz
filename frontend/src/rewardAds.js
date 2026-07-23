import createAdHandler from "monetag-tg-sdk";

const adHandler = createAdHandler(11203298);

export async function watchAdAndReward() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!initData) {
    throw new Error("Not running inside Telegram");
  }

  try {
    await adHandler();
  } catch (adErr) {
    throw new Error("Ad SDK error: " + (adErr?.message || adErr?.toString() || JSON.stringify(adErr)));
  }

  const response = await fetch(
    "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/reward-user",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error("Backend error: " + (result.error || "unknown"));
  }

  return result.user;
}
