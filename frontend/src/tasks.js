async function callTasks(payload) {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData;
  if (!initData) throw new Error("Not running inside Telegram");

  const response = await fetch(
    "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/tasks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, ...payload }),
    }
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Task request failed");
  return result;
}

export function listTasks() { return callTasks({ action: "list-tasks" }).then((r) => r.tasks); }
export function mySubmissions() { return callTasks({ action: "my-submissions" }).then((r) => r.submissions); }
export function submitTask(taskId, proofLink) { return callTasks({ action: "submit-task", taskId, proofLink }); }
export function startMobideaTask(taskId) { return callTasks({ action: "start-mobidea-task", taskId }); }
