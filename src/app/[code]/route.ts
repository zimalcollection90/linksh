import { NextRequest, after } from "next/server";
import { createAdminClient } from "../../../supabase/admin";
import { createClient } from "../../../supabase/server";
import { CC_TO_COUNTRY } from "../../utils/geo";
import { inngest } from "../../inngest/client";

export const runtime = "edge";

// ─── Comprehensive bot / crawler / preview-service UA patterns ────────────────
// These cover: social media previewers, search crawlers, headless browsers,
// monitoring tools, HTTP libraries, and other automated systems.
const BOT_UA_PATTERN =
  /bot|crawler|spider|crawl|scraper|preview|prerender|preload|prefetch|meta-externalagent|facebookexternalhit|facebot|whatsapp|telegrambot|discordbot|linkedinbot|slackbot|slackhq|twitterbot|pinterest|applebot|googlebot|google-read-aloud|googleimageproxy|feedburner|feedfetcher|bingbot|msnbot|slurp|duckduckbot|baiduspider|yandex|yandexbot|petalbot|bytespider|ahrefsbot|semrushbot|mj12bot|dotbot|blexbot|rogerbot|exabot|archive\.org_bot|ia_archiver|uptimerobot|statuscake|pingdom|gtmetrix|datadog|headlesschrome|headless|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|python\/|curl\/|wget\/|libwww|java\/|go-http-client|okhttp|axios|node-fetch|got\/|scrapy|httpx|requests|urllib|mechanize|ruby|perl|php\/|cfnetwork|nativehost|dataprovider|mail\.ru|barkrowler|proximic|scoutjet|seznambot|seokicks|sistrix|similarweb|deepcrawl|netcraft|nikto|masscan|zgrab|nuclei|dirbuster|sqlmap|nmap/i;

// Minimal UA length for a real browser (e.g. "Mozilla/5.0 ..." is always > 60 chars)
const MIN_REAL_UA_LENGTH = 50;

/**
 * Multi-signal bot detection at the edge.
 * Returns true if the request is likely from a bot/crawler/preview service.
 * When true, we redirect silently without recording any analytics.
 */
function isLikelyBot(userAgent: string, request: NextRequest): boolean {
  // 1. Empty user-agent → definitely automated
  if (!userAgent || userAgent.trim().length === 0) return true;

  // 2. Known bot/crawler/preview pattern match
  if (BOT_UA_PATTERN.test(userAgent)) return true;

  // 3. Suspiciously short user-agent (no real browser is this terse)
  if (userAgent.length < MIN_REAL_UA_LENGTH) return true;

  // 4. Missing Accept header — real browsers always send this
  const accept = request.headers.get("accept");
  if (!accept) return true;

  // 5. Missing Accept-Language header — social media previewers routinely omit this.
  //    Every major browser (Chrome, Firefox, Safari, Edge) sends Accept-Language.
  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) return true;

  return false;
}

/**
 * Create a lightweight browser fingerprint for accurate Unique User deduplication.
 * We combine the visitor's IP + a normalised User-Agent hash so that:
 *  - Two people on the same shared IP (e.g. café Wi-Fi) are counted as 2 unique users.
 *  - One person whose ISP rotates their IP is still deduplicated by their browser fingerprint.
 *
 * We do NOT store raw PII — only the hex digest of the combined string.
 */
async function buildFingerprint(ip: string | null, userAgent: string): Promise<string | null> {
  if (!ip && !userAgent) return null;
  // Normalise UA: lower-case, strip version numbers to group same browser across minor updates
  const normUA = userAgent
    .toLowerCase()
    .replace(/[\d]+\.[\d]+\.[\d]+\.[\d]+/g, "V") // strip 4-part versions
    .replace(/[\d]+\.[\d]+\.[\d]+/g, "V")          // strip 3-part versions
    .replace(/[\d]+\.[\d]+/g, "V")                 // strip 2-part versions
    .trim();
  const raw = `${ip ?? ""}|${normUA}`;
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

const isSkipCode = (code: string) => {
  return (
    code === "tempobook" ||
    code === "dashboard" ||
    code === "sign-in" ||
    code === "sign-up" ||
    code === "forgot-password" ||
    code === "favicon.ico" ||
    code === "favicon"
  );
};

function detectDeviceType(userAgent: string) {
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
  return isMobile ? "mobile" : "desktop";
}

function detectBrowser(userAgent: string) {
  if (/chrome/i.test(userAgent) && !/edge|edg/i.test(userAgent)) return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return "Safari";
  if (/edge|edg/i.test(userAgent)) return "Edge";
  if (/opera|opr/i.test(userAgent)) return "Opera";
  return "Other";
}

function detectOS(userAgent: string) {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  if (/android/i.test(userAgent)) return "Android";
  if (/ios|iphone|ipad/i.test(userAgent)) return "iOS";
  return "Other";
}

function normalizeCode(rawCode: string) {
  return (rawCode || "").trim();
}

function isValidShortCode(code: string) {
  return /^[A-Za-z0-9_-]{3,64}$/.test(code);
}

function redirectResponse(destinationUrl: string) {
  return new Response(null, {
    status: 302,
    headers: {
      location: destinationUrl,
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      pragma: "no-cache",
      expires: "0",
    },
  });
}

function protectedLinkResponse() {
  const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Protected Link</title>
          <style>
            body { margin:0; background:#0b1220; color:#e5e7eb; font-family: ui-sans-serif, system-ui; }
            .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
            .card { width:100%; max-width:420px; background:#111827; border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:20px; }
            input, button { width:100%; box-sizing:border-box; border-radius:12px; padding:12px 14px; }
            input { background:#0b1220; border:1px solid rgba(255,255,255,.12); color:#e5e7eb; margin-top:12px; }
            button { margin-top:14px; background:#7c3aed; border:none; color:white; cursor:pointer; }
            .hint { color:rgba(229,231,235,.75); margin-top:8px; font-size:14px; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="card">
              <h1 style="margin:0; font-size:20px;">This link is protected</h1>
              <div class="hint">Enter the password to unlock the destination.</div>
              <form method="get">
                <input name="pw" type="password" placeholder="Password" required />
                <button type="submit">Unlock</button>
              </form>
            </div>
          </div>
        </body>
      </html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

type FallbackResolvedLink = {
  id: string;
  user_id: string | null;
  destination_url: string;
  is_password_protected: boolean | null;
  password_hash: string | null;
  expires_at: string | null;
};

async function resolveLinkFallback(code: string): Promise<FallbackResolvedLink | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("links")
    .select("id, user_id, destination_url, is_password_protected, password_hash, expires_at")
    .eq("short_code", code)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  if (data.expires_at) {
    const expiresAtMs = Date.parse(data.expires_at);
    if (!Number.isNaN(expiresAtMs) && expiresAtMs <= Date.now()) return null;
  }

  return data as FallbackResolvedLink;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const rawCode = (await params).code;
  const code = normalizeCode(rawCode);

  if (!code || !isValidShortCode(code) || isSkipCode(code)) {
    return new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const pw = url.searchParams.get("pw");

  const userAgent = request.headers.get("user-agent") || "";
  const referer = request.headers.get("referer") || null;
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ip = request.headers.get("x-real-ip") || forwardedFor.split(",")[0]?.trim() || null;

  // ── LAYER 1: Edge bot pre-filter ──────────────────────────────────────────
  // If this is a known bot / crawler / preview service, redirect silently
  // without touching the database or firing any analytics event.
  if (isLikelyBot(userAgent, request)) {
    // We still need to resolve the destination URL to redirect properly.
    // Use the fast RPC first, fall back to direct DB query.
    const supabase = createAdminClient();
    const { data: rpcData } = await supabase.rpc("resolve_link_and_log_click", {
      p_code: code,
      p_ip: null,          // do NOT pass IP — prevents any DB write
      p_user_agent: null,  // do NOT pass UA — skips bot-check insert path
      p_referrer: null,
      p_device_type: null,
      p_browser: null,
      p_os: null,
      p_password: pw || null,
      p_country: null,
      p_country_code: null,
      p_city: null,
      p_fingerprint: null,
    });

    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const botDest = rpcRow?.destination_url;
    if (botDest) return redirectResponse(botDest);

    // Fallback if RPC fails for bots
    const fallback = await resolveLinkFallback(code);
    if (!fallback) return new Response("Not Found", { status: 404 });
    if (fallback.is_password_protected && !pw) return protectedLinkResponse();
    return redirectResponse(fallback.destination_url);
  }
  // ── End of bot pre-filter ─────────────────────────────────────────────────

  const deviceType = detectDeviceType(userAgent);
  const browser = detectBrowser(userAgent);
  const os = detectOS(userAgent);

  // Extract geo from CDN/edge headers (Vercel, Cloudflare) — zero latency
  const cfCountry = request.headers.get("cf-ipcountry");
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  const vercelCity = request.headers.get("x-vercel-ip-city");
  const cfCity = request.headers.get("cf-ipcity");

  const rawEdgeCode = (cfCountry || vercelCountry || "").toUpperCase().trim();
  const edgeCountryCode =
    rawEdgeCode && rawEdgeCode.length === 2 && rawEdgeCode !== "XX" && rawEdgeCode !== "T1"
      ? rawEdgeCode
      : null;
  const edgeCountry = edgeCountryCode ? CC_TO_COUNTRY[edgeCountryCode] || null : null;
  const rawEdgeCity = vercelCity
    ? decodeURIComponent(vercelCity).trim()
    : (cfCity || "").trim() || null;
  const edgeCity =
    rawEdgeCity && rawEdgeCity.toLowerCase() !== "unknown" ? rawEdgeCity : null;

  const hasEdgeGeo = Boolean(edgeCountryCode && edgeCountry);

  // Build browser fingerprint for accurate unique-user deduplication
  const fingerprint = await buildFingerprint(ip, userAgent);

  // Use Admin Client for the critical path to avoid auth overhead in redirect
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("resolve_link_and_log_click", {
    p_code: code,
    p_ip: ip,
    p_user_agent: userAgent,
    p_referrer: referer,
    p_device_type: deviceType,
    p_browser: browser,
    p_os: os,
    p_password: pw || null,
    p_country: null,
    p_country_code: null,
    p_city: null,
    p_fingerprint: fingerprint,
  });

  if (error) {
    const fallbackLink = await resolveLinkFallback(code);
    if (!fallbackLink) {
      return new Response("Not Found", { status: 404 });
    }

    const requiresPassword = Boolean(fallbackLink.is_password_protected);
    if (requiresPassword) {
      if (!pw || !fallbackLink.password_hash) {
        return protectedLinkResponse();
      }

      const { data: verifyData, error: verifyError } = await supabase.rpc(
        "verify_link_password",
        { p_link_id: fallbackLink.id, p_password: pw },
      );

      if (verifyError || !verifyData) {
        return protectedLinkResponse();
      }
    }

    // Move Inngest into 'after' — non-blocking
    after(async () => {
      try {
        await inngest.send({
          name: "analytics/click.recorded",
          data: {
            ip,
            linkId: fallbackLink.id,
            userId: fallbackLink.user_id,
            userAgent,
            referer,
            deviceType,
            browser,
            os,
            fingerprint,
            countryHint: hasEdgeGeo ? edgeCountry : null,
            countryCodeHint: hasEdgeGeo ? edgeCountryCode : null,
            cityHint: hasEdgeGeo ? edgeCity : null,
          },
        });
      } catch (err: any) {
        console.error("[redirect] inngest.send failed (fallback path):", err?.message);
      }
    });

    return redirectResponse(fallbackLink.destination_url);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const requiresPassword = Boolean(row?.requires_password);
  const destinationUrl = row?.destination_url;
  const clickEventId: string | null = row?.click_event_id ?? null;

  if (requiresPassword) {
    return protectedLinkResponse();
  }

  if (!destinationUrl) {
    return new Response("Not Found", { status: 404 });
  }

  // Move Analytics/Inngest into 'after' — non-blocking
  after(async () => {
    if (clickEventId) {
      try {
        await inngest.send({
          name: "analytics/enrich.existing",
          data: {
            clickEventId,
            ip,
            countryHint: hasEdgeGeo ? edgeCountry : null,
            countryCodeHint: hasEdgeGeo ? edgeCountryCode : null,
            cityHint: hasEdgeGeo ? edgeCity : null,
          },
        });
      } catch (err: any) {
        console.error("[redirect] inngest.send (enrich existing) failed:", err?.message);
      }
    } else {
      try {
        await inngest.send({
          name: "analytics/click.recorded",
          data: {
            ip,
            linkId: row?.link_id ?? null,
            userId: row?.user_id ?? null,
            userAgent,
            referer,
            deviceType,
            browser,
            os,
            fingerprint,
            countryHint: hasEdgeGeo ? edgeCountry : null,
            countryCodeHint: hasEdgeGeo ? edgeCountryCode : null,
            cityHint: hasEdgeGeo ? edgeCity : null,
          },
        });
      } catch (err: any) {
        console.error("[redirect] inngest.send failed:", err?.message);
      }
    }
  });

  return redirectResponse(destinationUrl);
}
