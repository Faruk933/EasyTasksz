const SUPABASE_URL = "https://iewdxruivjwblsnsjicq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OTGy-BXC2O42Rw9RM5UlRA_QLKu6tfF";

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

console.log("Supabase Connected");
