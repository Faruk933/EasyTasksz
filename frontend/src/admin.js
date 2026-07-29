async function callAdmin(payload) {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!initData) {
    throw new Error("Not running inside Telegram");
  }

  const response = await fetch(
    "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/admin",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, ...payload }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Admin request failed");
  }

  return result;
}

export function listWithdrawals() {
  return callAdmin({ action: "list" }).then((r) => r.withdrawals);
}

export function updateWithdrawalStatus(withdrawalId, status) {
  return callAdmin({ action: "update-status", withdrawalId, status });
}

export function getStats() {
  return callAdmin({ action: "stats" });
}

export function listUsers(search) {
  return callAdmin({ action: "list-users", search }).then((r) => r.users);
}

export function updateUserBalance(targetTelegramId, newBalance) {
  return callAdmin({ action: "update-balance", targetTelegramId, newBalance });
}

export function toggleUserBan(targetTelegramId) {
  return callAdmin({ action: "toggle-ban", targetTelegramId });
}
