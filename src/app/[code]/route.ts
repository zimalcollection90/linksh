import { NextRequest } from "next/server";
import { createAdminClient } from "../../../supabase/admin";
import { createClient } from "../../../supabase/server";

const isSkipCode = (code: string) => {
  // `/[code]` only matches a single path segment like `/<code>`.
  // Skip only real one-segment app routes to avoid false positives for
  // random/custom aliases (e.g. an alias starting with "api").
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
  return "Unknown";
}

function detectOS(userAgent: string) {
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  if (/android/i.test(userAgent)) return "Android";
  if (/ios|iphone|ipad/i.test(userAgent)) return "iOS";
  return "Unknown";
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("links")
    .select("id, user_id, destination_url, is_password_protected, password_hash, expires_at")
    .eq("short_code", code)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[redirect] fallback resolve query failed", {
      code,
      errorCode: error.code,
      errorMessage: error.message,
    });
    return null;
  }

  if (!data) return null;

  if (data.expires_at) {
    const expiresAtMs = Date.parse(data.expires_at);
    if (!Number.isNaN(expiresAtMs) && expiresAtMs <= Date.now()) {
      return null;
    }
  }

  return data as FallbackResolvedLink;
}

async function logClickFallbackAsync(args: {
  linkId: string;
  userId: string | null;
  ip: string | null;
  userAgent: string;
  referer: string | null;
  deviceType: string;
  browser: string;
  os: string;
  requestUrl: string;
}) {
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return;
  }

  const isBot = /(bot|crawler|spider|crawl|scraper|facebookexternalhit|pingdom|headless)/i.test(
    args.userAgent || "",
  );

  let isSelfClick = false;
  if (args.ip && args.userId) {
    const { data: exclusion } = await adminClient
      .from("ip_exclusions")
      .select("id")
      .eq("user_id", args.userId)
      .eq("ip_address", args.ip)
      .maybeSingle();
    isSelfClick = Boolean(exclusion);
  }

  let ipClickedLast24h = false;
  if (args.ip && !isSelfClick) {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: priorClick } = await adminClient
      .from("click_events")
      .select("id")
      .eq("link_id", args.linkId)
      .eq("ip_address", args.ip)
      .gte("clicked_at", sinceIso)
      .maybeSingle();
    ipClickedLast24h = Boolean(priorClick);
  }

  const isUnique = Boolean(args.ip) && !isBot && !isSelfClick && !ipClickedLast24h;

  const payload = {
    link_id: args.linkId,
    user_id: args.userId,
    ip_address: args.ip,
    country: null,
    country_code: null,
    city: null,
    device_type: args.deviceType,
    browser: args.browser,
    os: args.os,
    referrer: args.referer,
    user_agent: args.userAgent,
    is_unique: isUnique,
    is_bot: isBot,
    quality_score: isBot ? 0 : 100,
  };

  const { data: clickData, error: clickError } = await adminClient
    .from("click_events")
    .insert(payload)
    .select("id")
    .single();

  if (clickError) {
    console.error("[redirect] fallback click logging failed", {
      linkId: args.linkId,
      errorCode: clickError.code,
      errorMessage: clickError.message,
    });
    return;
  }

  const clickEventId = clickData?.id ?? null;

  if (clickEventId && args.ip) {
    const enrichUrl = new URL("/api/geoip/enrich", args.requestUrl);
    void fetch(enrichUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ click_event_id: clickEventId, ip_address: args.ip }),
    }).catch(() => undefined);
  }

  if (!payload.is_unique) return;

  const { error: countError } = await adminClient.rpc("increment_link_clicks", {
    link_id: args.linkId,
  });

  if (countError) {
    console.error("[redirect] fallback click-count increment failed", {
      linkId: args.linkId,
      clickEventId,
      errorCode: countError.code,
      errorMessage: countError.message,
    });
  }
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
  const ip = forwardedFor.split(",")[0]?.trim() || null;

  const deviceType = detectDeviceType(userAgent);
  const browser = detectBrowser(userAgent);
  const os = detectOS(userAgent);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_link_and_log_click", {
    p_code: code,
    p_ip: ip,
    p_user_agent: userAgent,
    p_referrer: referer,
    p_device_type: deviceType,
    p_browser: browser,
    p_os: os,
    p_password: pw || null,
  });

  if (error) {
    console.error("[redirect] resolve rpc failed, trying fallback", {
      code,
      errorCode: error.code,
      errorMessage: error.message,
    });

    const fallbackLink = await resolveLinkFallback(code);
    if (!fallbackLink) {
      return new Response("Not Found", { status: 404 });
    }

    const requiresPassword = Boolean(fallbackLink.is_password_protected);
    if (requiresPassword) {
      if (!pw || !fallbackLink.password_hash) {
        return protectedLinkResponse();
      }

      const { data: verifyData, error: verifyError } = await supabase.rpc("verify_link_password", {
        p_link_id: fallbackLink.id,
        p_password: pw,
      });

      if (verifyError || !verifyData) {
        return protectedLinkResponse();
      }
    }

    void logClickFallbackAsync({
      linkId: fallbackLink.id,
      userId: fallbackLink.user_id,
      ip,
      userAgent,
      referer,
      deviceType,
      browser,
      os,
      requestUrl: request.url,
    });

    return redirectResponse(fallbackLink.destination_url);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const requiresPassword = Boolean(row?.requires_password);
  const destinationUrl = row?.destination_url;
  const clickEventId = row?.click_event_id;

  if (requiresPassword) {
    return protectedLinkResponse();
  }

  if (!destinationUrl) {
    return new Response("Not Found", { status: 404 });
  }

  // Fire-and-forget GeoIP enrichment (does not block the redirect).
  if (clickEventId && ip) {
    const enrichUrl = new URL("/api/geoip/enrich", request.url);
    void fetch(enrichUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ click_event_id: clickEventId, ip_address: ip }),
    }).catch(() => undefined);
  }

  return redirectResponse(destinationUrl);
}

