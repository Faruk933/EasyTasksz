function waitForAdSdk(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      if (typeof window.show_11203298 === "function") {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error("Ad SDK did not load in time"));
      } else {
        setTimeout(check, 200);
      }
    }
    check();
  });
}

export async function watchAdAndReward() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;

  if (!initData) {
    throw new Error("Not running inside Telegram");
  }

  await waitForAdSdk();

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
