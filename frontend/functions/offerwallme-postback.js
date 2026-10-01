const UPSTREAM = "https://iewdxruivjwblsnsjicq.supabase.co/functions/v1/offerwallme-postback";

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  try {
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);

    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers,
      body: request.body,
    });

    const responseHeaders = new Headers();
    const responseType = upstream.headers.get("content-type");
    if (responseType) responseHeaders.set("content-type", responseType);
    responseHeaders.set("cache-control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Offerwall.me postback proxy error:", error);
    return new Response("Bad Gateway", { status: 502 });
  }
}
