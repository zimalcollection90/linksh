import { inngest } from "../client";
import { createAdminClient } from "../../../supabase/admin";
import { CC_TO_COUNTRY } from "../../utils/geo";

/**
 * Resolve a real IP address to country/city using multiple fallback GeoIP providers.
 * Runs inside Inngest so it has no serverless timeout — full retry guarantees.
 */
async function resolveGeoIP(
  ip: string,
): Promise<{ country: string | null; countryCode: string | null; city: string | null }> {
  const result = {
    country: null as string | null,
    countryCode: null as string | null,
    city: null as string | null,
  };

  if (!ip) return result;

  const isLocal =
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.includes("localhost");
  if (isLocal) return { country: "Localhost / Internal", countryCode: "LH", city: "Testing" };

  const isPrivate =
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.length < 7;
  if (isPrivate) return result;

  // Provider 1: ipwho.is
  try {
    const resp = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data?.success && data.country_code) {
        const cc = data.country_code.toUpperCase();
        result.countryCode = cc;
        result.country = data.country || CC_TO_COUNTRY[cc] || null;
        result.city = data.city || null;
        if (result.country) return result;
      }
    }
  } catch { /* try next */ }

  // Provider 2: ipapi.co
  try {
    const resp = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: "application/json", "User-Agent": "shortlink-tracker/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data && !data.error && data.country_code) {
        const cc = (data.country_code || "").toUpperCase();
        result.countryCode = cc || null;
        result.country = data.country_name || (cc ? CC_TO_COUNTRY[cc] : null) || null;
        result.city = data.city || null;
        if (result.country) return result;
      }
    }
  } catch { /* try next */ }

  // Provider 3: ip-api.com
  try {
    const resp = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=country,countryCode,city,status`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) },
    );
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data?.status === "success" && data.countryCode) {
        const cc = (data.countryCode || "").toUpperCase();
        result.countryCode = cc || null;
        result.country = data.country || (cc ? CC_TO_COUNTRY[cc] : null) || null;
        result.city = data.city || null;
        if (result.country) return result;
      }
    }
  } catch { /* try next */ }

  // Provider 4: freeipapi.com
  try {
    const resp = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data?.countryCode) {
        const cc = (data.countryCode || "").toUpperCase();
        result.countryCode = cc || null;
        result.country = data.countryName || (cc ? CC_TO_COUNTRY[cc] : null) || null;
        result.city = data.cityName || null;
        if (result.country) return result;
      }
    }
  } catch { /* try next */ }

  return result;
}

// ─── Inngest v4: triggers are inside the options object ────────────────────────

/**
 * Handles a new click event end-to-end:
 *  1. Resolve GeoIP
 *  2. Insert click_events row with full data
 *  3. Increment link click counter
 */
export const enrichClickFunction = inngest.createFunction(
  {
    id: "enrich-click-geo",
    name: "Enrich Click with Geo + Log",
    triggers: [{ event: "analytics/click.recorded" }],
    retries: 4,
  },
  async ({ event, step }: { event: any; step: any }) => {
    const {
      ip,
      linkId,
      userId,
      userAgent,
      referer,
      deviceType,
      browser,
      os,
      countryHint,
      countryCodeHint,
      cityHint,
    } = event.data;

    // Step 1: Resolve GeoIP (skip if edge CDN already gave us the country)
    const geo = await step.run("resolve-geo", async () => {
      if (countryHint && countryCodeHint) {
        return { country: countryHint, countryCode: countryCodeHint, city: cityHint };
      }
      if (!ip) {
        return { country: null, countryCode: null, city: null };
      }
      return resolveGeoIP(ip);
    });

    const safeCountry =
      geo.country && !["unknown", "other", ""].includes(geo.country.toLowerCase())
        ? geo.country : null;
    const safeCountryCode =
      geo.countryCode && !["xx", "unknown", ""].includes(geo.countryCode.toLowerCase())
        ? geo.countryCode.toUpperCase() : null;
    const safeCity =
      geo.city && !["unknown", ""].includes(geo.city.toLowerCase()) ? geo.city : null;

    // Step 2: Detect bots, duplicates, and insert click event
    const clickResult = await step.run("insert-click-event", async () => {
      const adminClient = createAdminClient();

      const isBotRaw = /(bot|crawler|spider|crawl|scraper|pingdom|headless)/i.test(userAgent || "");
      const isFacebook = /(facebookexternalhit|facebot|facebook)/i.test(userAgent || "");
      const isBot = isBotRaw && !isFacebook;

      let isSelfClick = false;
      if (ip && userId) {
        const { data: exclusion } = await adminClient
          .from("ip_exclusions").select("id")
          .eq("user_id", userId).eq("ip_address", ip).maybeSingle();
        isSelfClick = Boolean(exclusion);
      }

      let ipClickedLast24h = false;
      if (ip && !isSelfClick && !isBot) {
        const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: priorClick } = await adminClient
          .from("click_events").select("id")
          .eq("link_id", linkId).eq("ip_address", ip)
          .gte("clicked_at", sinceIso).eq("is_unique", true).maybeSingle();
        ipClickedLast24h = Boolean(priorClick);
      }

      const isUnique = Boolean(ip) && !isBot && !isSelfClick && !ipClickedLast24h;
      const isFiltered = isBot || isSelfClick || ipClickedLast24h;
      const filterReason = isBot ? "bot" : isSelfClick ? "self_click" : ipClickedLast24h ? "duplicate_ip_24h" : null;

      const { data: clickData, error } = await adminClient
        .from("click_events")
        .insert({
          link_id: linkId,
          user_id: userId,
          ip_address: ip,
          country: safeCountry,
          country_code: safeCountryCode,
          city: safeCity,
          device_type: deviceType,
          browser,
          os,
          referrer: referer,
          user_agent: userAgent,
          is_unique: isUnique,
          is_bot: isBot,
          is_filtered: isFiltered,
          filter_reason: filterReason,
          quality_score: isBot ? 0 : isSelfClick ? 10 : ipClickedLast24h ? 30 : 100,
        })
        .select("id").single();

      if (error) throw new Error(`insert click_event failed: ${error.message}`);
      return { clickEventId: clickData?.id, isUnique };
    });

    // Step 3: Increment link click counter (only for unique real clicks)
    if (clickResult.isUnique && clickResult.clickEventId) {
      await step.run("increment-click-count", async () => {
        const adminClient = createAdminClient();
        const { error } = await adminClient.rpc("increment_link_clicks", { link_id: linkId });
        if (error) throw new Error(`increment_link_clicks failed: ${error.message}`);
      });
    }

    return { country: safeCountry, countryCode: safeCountryCode, isUnique: clickResult.isUnique };
  },
);

/**
 * Enriches an EXISTING click_events row (created by the Supabase RPC) with geo data.
 */
export const enrichExistingClickFunction = inngest.createFunction(
  {
    id: "enrich-existing-click-geo",
    name: "Enrich Existing Click Row with Geo",
    triggers: [{ event: "analytics/enrich.existing" }],
    retries: 4,
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { clickEventId, ip, countryHint, countryCodeHint, cityHint } = event.data;

    await step.run("resolve-and-update-geo", async () => {
      let resolvedCountry = countryHint as string | null;
      let resolvedCountryCode = countryCodeHint as string | null;
      let resolvedCity = cityHint as string | null;

      if ((!resolvedCountry || !resolvedCountryCode) && ip) {
        const geo = await resolveGeoIP(ip);
        resolvedCountry = geo.country;
        resolvedCountryCode = geo.countryCode;
        resolvedCity = geo.city;
      }

      if (!resolvedCountry && !resolvedCountryCode) return;

      const safeCountry = resolvedCountry && !["unknown", "other", ""].includes(resolvedCountry.toLowerCase()) ? resolvedCountry : null;
      const safeCountryCode = resolvedCountryCode && !["xx", "unknown", ""].includes(resolvedCountryCode.toLowerCase()) ? resolvedCountryCode.toUpperCase() : null;
      const safeCity = resolvedCity && !["unknown", ""].includes(resolvedCity.toLowerCase()) ? resolvedCity : null;

      if (!safeCountry && !safeCountryCode) return;

      const adminClient = createAdminClient();
      const { error } = await adminClient
        .from("click_events")
        .update({ country: safeCountry, country_code: safeCountryCode, city: safeCity })
        .eq("id", clickEventId);

      if (error) throw new Error(`update click_event geo failed: ${error.message}`);
    });

    return { clickEventId, enriched: true };
  },
);
