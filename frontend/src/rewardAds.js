export async function watchAdAndReward() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!initData) {
    throw new Error("Not running inside Telegram");
  }

  if (typeof window.show_3385926 !== "function") {
    throw new Error("Ad SDK not loaded yet. Try again in a moment.");
  }

  await window.show_3385926();

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
    throw new Error(result.error || "Failed to reward user");
  }

  return result.user;
}
