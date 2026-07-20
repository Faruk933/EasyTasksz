// Supabase Configuration
const SUPABASE_URL = "https://iewdxruivjwblsnsjicq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OTGy-BXC2O42Rw9RM5UlRA_QLKu6tfF";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Telegram Mini App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Demo user if not inside Telegram
const telegramUser = tg.initDataUnsafe.user || {
  id: 123456789,
  username: "DemoUser",
  first_name: "Demo"
};

async function loadUser() {
  // Look for existing user
  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramUser.id)
    .single();

  // Create new user if none exists
  if (!user) {
    const { data } = await supabase
      .from("users")
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username || "",
        first_name: telegramUser.first_name || "",
        balance: 0,
        ads_watched: 0,
        total_earned: 0
      })
      .select()
      .single();

    user = data;
  }

  // Update UI
  const username = document.getElementById("username");
  const balance = document.getElementById("balance");

  if (username) {
    username.innerText =
      user.first_name || user.username || "User";
  }

  if (balance) {
    balance.innerText = "$" + Number(user.balance).toFixed(2);
  }
}

loadUser();
