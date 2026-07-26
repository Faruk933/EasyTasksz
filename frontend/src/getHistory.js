export async function fetchHistory() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!initData) {
    throw new Error("Not running inside Telegram");
  }

  const response = await fetch(
    "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/get-history",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Failed to load history");
  }

  return result.withdrawals;
}
