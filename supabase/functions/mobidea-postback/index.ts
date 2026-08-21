import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let params = url.searchParams;

    if (req.method !== "GET" && req.method !== "HEAD") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json();
        const merged = new URLSearchParams(url.search);
        for (const [key, value] of Object.entries(body || {})) {
          if (value !== undefined && value !== null) merged.set(key, String(value));
        }
        params = merged;
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const body = await req.text();
        const merged = new URLSearchParams(url.search);
        for (const [key, value] of new URLSearchParams(body)) merged.set(key, value);
        params = merged;
      }
    }

    const clickId = params.get("external_id") || params.get("EXTERNAL_ID") || params.get("click_id") || params.get("pub_click_id");
    const payoutRaw = params.get("money") || params.get("MONEY") || params.get("payout");
    const payout = payoutRaw == null ? NaN : Number(payoutRaw.replace(/,/g, ""));

    if (!clickId || !Number.isFinite(payout) || payout < 0) {
      return new Response("Ignored", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase.rpc("process_mobidea_conversion", {
      p_click_id: clickId,
      p_payout_usd: payout,
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.processed) return new Response("Already processed or unknown click", { status: 200 });
    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("Error: " + String(err), { status: 500 });
  }
});
