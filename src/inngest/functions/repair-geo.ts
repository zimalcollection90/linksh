import { inngest } from "../client";
import { createAdminClient } from "../../../supabase/admin";
import { CC_TO_COUNTRY } from "../../utils/geo";

async function resolveGeoIP(
  ip: string,
): Promise<{ country: string | null; countryCode: string | null }> {
  if (!ip || ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1") {
    return { country: "Localhost / Internal", countryCode: "LH" };
  }
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.length < 7
  ) {
    return { country: null, countryCode: null };
  }

  const providers = [
    async () => {
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(5000),
      });
      const d = await r.json();
      return d?.success ? { country: d.country as string, countryCode: (d.country_code as string)?.toUpperCase() } : null;
    },
    async () => {
      const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
        headers: { "User-Agent": "shortlink-repair/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      const d = await r.json();
      return d && !d.error && d.country_code
        ? { country: d.country_name as string, countryCode: (d.country_code as string)?.toUpperCase() }
        : null;
    },
    async () => {
      const r = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=country,countryCode,status`,
        { signal: AbortSignal.timeout(5000) },
      );
      const d = await r.json();
      return d?.status === "success"
        ? { country: d.country as string, countryCode: (d.countryCode as string)?.toUpperCase() }
        : null;
    },
    async () => {
      const r = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(5000),
      });
      const d = await r.json();
      return d?.countryCode
        ? { country: d.countryName as string, countryCode: (d.countryCode as string)?.toUpperCase() }
        : null;
    },
  ];

  for (const provider of providers) {
    try {
      const res = await provider();
      if (res?.country) return res;
    } catch { /* try next */ }
  }
  return { country: null, countryCode: null };
}

/**
 * Scheduled cron: runs every 6 hours to repair click_events rows missing country data.
 * Also manually triggerable via "analytics/repair.requested" event from the admin UI.
 */
export const repairGeoFunction = inngest.createFunction(
  {
    id: "repair-geo-background",
    name: "Repair Missing Geo Data",
    triggers: [
      { cron: "0 */6 * * *" },               // Auto: every 6 hours
      { event: "analytics/repair.requested" }, // Manual: from admin UI
    ],
    retries: 2,
    concurrency: { limit: 1 },               // Only one repair job at a time
  },
  async ({ step }: { step: any }) => {
    // Step 1: Fetch rows needing repair
    const pending = await step.run("fetch-pending-rows", async () => {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient
        .from("click_events")
        .select("id, ip_address, country, country_code")
        .or(
          "country.is.null,country_code.is.null,country.eq.Unknown,country.eq.Unknown Location,country_code.eq.XX",
        )
        .not("ip_address", "is", null)
        .limit(300);

      if (error) throw new Error(`fetch pending failed: ${error.message}`);

      return (data || []).filter(
        (r: { ip_address: string | null }) =>
          r.ip_address &&
          r.ip_address !== "::1" &&
          r.ip_address !== "127.0.0.1" &&
          !r.ip_address.startsWith("10.") &&
          !r.ip_address.startsWith("192.168."),
      );
    });

    if ((pending as any[]).length === 0) {
      return { message: "No rows need repair", repaired: 0 };
    }

    let repairedCount = 0;
    const BATCH_SIZE = 10;
    const rows = pending as Array<{ id: string; ip_address: string | null }>;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      await step.run(`repair-batch-${Math.floor(i / BATCH_SIZE)}`, async () => {
        const adminClient = createAdminClient();

        for (const record of batch) {
          if (!record.ip_address) continue;
          try {
            const geo = await resolveGeoIP(record.ip_address);
            if (!geo.country && !geo.countryCode) continue;

            const safeCountry =
              geo.country && !["unknown", ""].includes(geo.country.toLowerCase())
                ? geo.country : null;
            const safeCountryCode =
              geo.countryCode && !["xx", "unknown", ""].includes(geo.countryCode.toLowerCase())
                ? geo.countryCode.toUpperCase() : null;

            if (!safeCountry && !safeCountryCode) continue;

            const { error } = await adminClient
              .from("click_events")
              .update({ country: safeCountry, country_code: safeCountryCode })
              .eq("id", record.id);

            if (!error) repairedCount++;
          } catch { /* skip individual failures */ }
        }
      });

      // Pause between batches to respect GeoIP API rate limits
      if (i + BATCH_SIZE < rows.length) {
        await step.sleep(`rate-limit-pause-${Math.floor(i / BATCH_SIZE)}`, "2s");
      }
    }

    return {
      message: "Repair complete",
      repaired: repairedCount,
      totalChecked: rows.length,
    };
  },
);
