export async function watchAdAndReward() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!initData) {
    throw new Error("Not running inside Telegram");
  }

  if (typeof window.show_11203298 !== "function") {
    throw new Error("Ad SDK function not found on window");
  }

  try {
    await window.show_11203298();
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
