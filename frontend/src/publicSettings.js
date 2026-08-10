export async function getPublicSettings() {
  const response = await fetch(
    "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/public-settings"
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.settings;
}
