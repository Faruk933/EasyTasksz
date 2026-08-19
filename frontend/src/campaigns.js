const ENDPOINT = "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/campaigns";

async function callCampaigns(payload) {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) throw new Error("Not running inside Telegram");
  const response = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, ...payload }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Campaign action failed");
  return result;
}

export const previewCampaign = (targetType, campaignType, targetUserId) => callCampaigns({ action: "preview", targetType, campaignType, targetUserId });
export const createCampaign = (data) => callCampaigns({ action: "create", ...data });
export const processCampaign = (campaignId) => callCampaigns({ action: "process", campaignId });
export const listCampaigns = () => callCampaigns({ action: "history" });
