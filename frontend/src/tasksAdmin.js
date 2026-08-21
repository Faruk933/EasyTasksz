async function callTasksAdmin(payload) {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;
  if (!initData) throw new Error("Not running inside Telegram");
  const response = await fetch("https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/tasks-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, ...payload }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}
export function listTasksAdmin() { return callTasksAdmin({ action: "list-tasks" }).then((r) => r.tasks); }
export function createTask(title, instructions, rewardAmount, taskUrl, taskType, provider, offerId) { return callTasksAdmin({ action: "create-task", title, instructions, rewardAmount, taskUrl, taskType, provider, offerId }); }
export function updateTask(taskId, updates) { return callTasksAdmin({ action: "update-task", taskId, ...updates }); }
export function deleteTask(taskId) { return callTasksAdmin({ action: "delete-task", taskId }); }
export function listSubmissions() { return callTasksAdmin({ action: "list-submissions" }).then((r) => r.submissions); }
export function reviewSubmission(submissionId, status, comment) { return callTasksAdmin({ action: "review-submission", submissionId, status, comment }); }
