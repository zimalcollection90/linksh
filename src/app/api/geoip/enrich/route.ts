import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../supabase/admin";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const click_event_id = body?.click_event_id as string | undefined;
  const ip_address = body?.ip_address as string | undefined;

  if (!click_event_id || !ip_address) {
    return NextResponse.json({ error: "click_event_id and ip_address are required" }, { status: 400 });
  }

  // Avoid wasting calls on missing/empty IPs
  if (!ip_address || ip_address.length < 7) {
    return NextResponse.json({ ok: true });
  }

  let geoUrl: URL;
  const template = process.env.GEOIP_API_URL_TEMPLATE;
  if (template && template.includes("{{ip}}")) {
    geoUrl = new URL(template.replaceAll("{{ip}}", encodeURIComponent(ip_address)));
  } else {
    // Default to ipapi.co without a key
    geoUrl = new URL(`https://ipapi.co/${encodeURIComponent(ip_address)}/json/`);
  }

  const apiKey = process.env.GEOIP_API_KEY;
  if (apiKey) {
    const keyParam = process.env.GEOIP_API_KEY_QUERY_PARAM || "key";
    geoUrl.searchParams.set(keyParam, apiKey);
  }

  const resp = await fetch(geoUrl.toString(), {
    headers: { Accept: "application/json" },
    // Keep enrichment bounded so the request doesn't hang.
    // (This endpoint is fire-and-forget from the redirect handler.)
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!resp || !resp.ok) {
    return NextResponse.json({ ok: false });
  }

  const data = await resp.json().catch(() => null);
  if (!data) return NextResponse.json({ ok: false });

  // ipapi.co field mapping (also works for many GeoIP providers)
  const country = data.country_name || data.country || null;
  const country_code = data.country_code || data.countryCode || null;
  const city = data.city || null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("click_events")
    .update({
      country,
      country_code,
      city,
    })
    .eq("id", click_event_id);

  // If enrichment fails, we still don't want the redirect to break.
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

