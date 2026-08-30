// Supabase client is kept for compatibility with the existing page setup.
const SUPABASE_URL = "https://iewdxruivjwblsnsjicq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OTGy-BXC2O42Rw9RM5UlRA_QLKu6tfF";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

async function loadUser() {
  const username = document.getElementById("username");
  const balance = document.getElementById("balance");
  const avatar = document.getElementById("avatar");

  try {
    if (!tg) {
      throw new Error("Telegram WebApp is unavailable");
    }

    const initData = tg.initData;
    if (!initData) {
      throw new Error("Telegram session data is unavailable");
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/telegram-auth`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.user) {
      throw new Error(result.error || `Telegram authentication failed (${response.status})`);
    }

    const user = result.user;

    if (username) {
      username.innerText = user.first_name || user.username || "User";
    }

    if (balance) {
      balance.innerText = "$" + Number(user.balance ?? 0).toFixed(2);
    }

    if (avatar && user.photo_url) {
      avatar.src = user.photo_url;
    }
  } catch (error) {
    console.error("EasyTasksz user loading failed:", error);
    if (username) {
      username.innerText = "Unable to load profile";
    }
  }
}

loadUser();
