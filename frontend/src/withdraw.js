export async function requestWithdrawal(walletAddress, amount) {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!initData) {
    throw new Error("Not running inside Telegram");
  }

  const response = await fetch(
    "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/withdraw",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, walletAddress, amount }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Withdrawal failed");
  }

  return result;
}
