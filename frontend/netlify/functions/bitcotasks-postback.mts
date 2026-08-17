import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  const target = "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/bitcotasks-postback";
  const body = await req.text();
  const contentType = req.headers.get("content-type") || "application/x-www-form-urlencoded";

  const response = await fetch(target, {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

  const text = await response.text();
  return new Response(text || "ok", {
    status: response.ok ? 200 : response.status,
    headers: { "content-type": "text/plain" },
  });
};

export const config: Config = {
  path: "/bitcotasks-postback",
};
