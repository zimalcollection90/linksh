import { NextRequest } from "next/server";
import { createAdminClient } from "../../../supabase/admin";
import { createClient } from "../../../supabase/server";

// Country code to country name map for offline fallback
const CC_TO_COUNTRY: Record<string, string> = {
  AF:"Afghanistan",AL:"Albania",DZ:"Algeria",AD:"Andorra",AO:"Angola",AG:"Antigua and Barbuda",AR:"Argentina",AM:"Armenia",AU:"Australia",AT:"Austria",AZ:"Azerbaijan",BS:"Bahamas",BH:"Bahrain",BD:"Bangladesh",BB:"Barbados",BY:"Belarus",BE:"Belgium",BZ:"Belize",BJ:"Benin",BT:"Bhutan",BO:"Bolivia",BA:"Bosnia and Herzegovina",BW:"Botswana",BR:"Brazil",BN:"Brunei",BG:"Bulgaria",BF:"Burkina Faso",BI:"Burundi",CV:"Cabo Verde",KH:"Cambodia",CM:"Cameroon",CA:"Canada",CF:"Central African Republic",TD:"Chad",CL:"Chile",CN:"China",CO:"Colombia",KM:"Comoros",CD:"Congo (DRC)",CG:"Congo",CR:"Costa Rica",HR:"Croatia",CU:"Cuba",CY:"Cyprus",CZ:"Czech Republic",DK:"Denmark",DJ:"Djibouti",DM:"Dominica",DO:"Dominican Republic",EC:"Ecuador",EG:"Egypt",SV:"El Salvador",GQ:"Equatorial Guinea",ER:"Eritrea",EE:"Estonia",SZ:"Eswatini",ET:"Ethiopia",FJ:"Fiji",FI:"Finland",FR:"France",GA:"Gabon",GM:"Gambia",GE:"Georgia",DE:"Germany",GH:"Ghana",GR:"Greece",GD:"Grenada",GT:"Guatemala",GN:"Guinea",GW:"Guinea-Bissau",GY:"Guyana",HT:"Haiti",HN:"Honduras",HU:"Hungary",IS:"Iceland",IN:"India",ID:"Indonesia",IR:"Iran",IQ:"Iraq",IE:"Ireland",IL:"Israel",IT:"Italy",JM:"Jamaica",JP:"Japan",JO:"Jordan",KZ:"Kazakhstan",KE:"Kenya",KI:"Kiribati",KW:"Kuwait",KG:"Kyrgyzstan",LA:"Laos",LV:"Latvia",LB:"Lebanon",LS:"Lesotho",LR:"Liberia",LY:"Libya",LI:"Liechtenstein",LT:"Lithuania",LU:"Luxembourg",MG:"Madagascar",MW:"Malawi",MY:"Malaysia",MV:"Maldives",ML:"Mali",MT:"Malta",MH:"Marshall Islands",MR:"Mauritania",MU:"Mauritius",MX:"Mexico",FM:"Micronesia",MD:"Moldova",MC:"Monaco",MN:"Mongolia",ME:"Montenegro",MA:"Morocco",MZ:"Mozambique",MM:"Myanmar",NA:"Namibia",NR:"Nauru",NP:"Nepal",NL:"Netherlands",NZ:"New Zealand",NI:"Nicaragua",NE:"Niger",NG:"Nigeria",NO:"Norway",OM:"Oman",PK:"Pakistan",PW:"Palau",PA:"Panama",PG:"Papua New Guinea",PY:"Paraguay",PE:"Peru",PH:"Philippines",PL:"Poland",PT:"Portugal",QA:"Qatar",RO:"Romania",RU:"Russia",RW:"Rwanda",KN:"Saint Kitts and Nevis",LC:"Saint Lucia",VC:"Saint Vincent and the Grenadines",WS:"Samoa",SM:"San Marino",ST:"Sao Tome and Principe",SA:"Saudi Arabia",SN:"Senegal",RS:"Serbia",SC:"Seychelles",SL:"Sierra Leone",SG:"Singapore",SK:"Slovakia",SI:"Slovenia",SB:"Solomon Islands",SO:"Somalia",ZA:"South Africa",SS:"South Sudan",ES:"Spain",LK:"Sri Lanka",SD:"Sudan",SR:"Suriname",SE:"Sweden",CH:"Switzerland",SY:"Syria",TW:"Taiwan",TJ:"Tajikistan",TZ:"Tanzania",TH:"Thailand",TL:"Timor-Leste",TG:"Togo",TO:"Tonga",TT:"Trinidad and Tobago",TN:"Tunisia",TR:"Turkey",TM:"Turkmenistan",TV:"Tuvalu",UG:"Uganda",UA:"Ukraine",AE:"United Arab Emirates",GB:"United Kingdom",US:"United States",UY:"Uruguay",UZ:"Uzbekistan",VU:"Vanuatu",VE:"Venezuela",VN:"Vietnam",YE:"Yemen",ZM:"Zambia",ZW:"Zimbabwe",
};

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

/**
 * Resolve GeoIP using multiple fallback services.
 */
async function resolveGeoIP(ip: string): Promise<{ country: string | null; countryCode: string | null; city: string | null }> {
  const result = { country: null as string | null, countryCode: null as string | null, city: null as string | null };

  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.length < 7) {
    return result;
  }

  // Try ipapi.co first
  try {
    const resp = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: "application/json", "User-Agent": "shortlink-tracker/1.0" },
      signal: AbortSignal.timeout(1200),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data && !data.error) {
        const cc = (data.country_code || "").toUpperCase();
        result.countryCode = cc || null;
        result.country = data.country_name || (cc ? CC_TO_COUNTRY[cc] : null) || null;
        result.city = data.city || null;
        if (result.country) return result;
      }
    }
  } catch { /* fall through */ }

  // Fallback: ip-api.com
  try {
    const resp = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=country,countryCode,city,status`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1200),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => null);
      if (data && data.status === "success") {
        const cc = (data.countryCode || "").toUpperCase();
        result.countryCode = cc || null;
        result.country = data.country || (cc ? CC_TO_COUNTRY[cc] : null) || null;
        result.city = data.city || null;
        if (result.country) return result;
      }
    }
  } catch { /* fall through */ }

  return result;
}

/**
 * Async geo enrichment: update the click_event row after redirect has been sent.
 */
async function enrichClickGeoAsync(clickEventId: string, ip: string) {
  try {
    const geo = await resolveGeoIP(ip);
    if (!geo.countryCode && !geo.country) return;
    const adminClient = createAdminClient();
    await adminClient
      .from("click_events")
      .update({ country: geo.country, country_code: geo.countryCode, city: geo.city })
      .eq("id", clickEventId)
      .is("country", null);
  } catch (err: any) {
    console.error("[redirect] geo enrich failed:", err?.message);
  }
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

  if (error || !data) return null;

  if (data.expires_at) {
    const expiresAtMs = Date.parse(data.expires_at);
    if (!Number.isNaN(expiresAtMs) && expiresAtMs <= Date.now()) return null;
  }

  return data as FallbackResolvedLink;
}

async function logClickFallbackAsync(args: {
  linkId: string;
  userId: string | null;
  ip: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  userAgent: string;
  referer: string | null;
  deviceType: string;
  browser: string;
  os: string;
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
  if (args.ip && !isSelfClick && !isBot) {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: priorClick } = await adminClient
      .from("click_events")
      .select("id")
      .eq("link_id", args.linkId)
      .eq("ip_address", args.ip)
      .gte("clicked_at", sinceIso)
      .eq("is_unique", true)
      .maybeSingle();
    ipClickedLast24h = Boolean(priorClick);
  }

  const isUnique = Boolean(args.ip) && !isBot && !isSelfClick && !ipClickedLast24h;
  const isFiltered = isBot || isSelfClick || ipClickedLast24h;
  const filterReason = isBot ? "bot" : isSelfClick ? "self_click" : ipClickedLast24h ? "duplicate_ip_24h" : null;

  const { data: clickData } = await adminClient
    .from("click_events")
    .insert({
      link_id: args.linkId,
      user_id: args.userId,
      ip_address: args.ip,
      country: args.country,
      country_code: args.countryCode,
      city: args.city,
      device_type: args.deviceType,
      browser: args.browser,
      os: args.os,
      referrer: args.referer,
      user_agent: args.userAgent,
      is_unique: isUnique,
      is_bot: isBot,
      is_filtered: isFiltered,
      filter_reason: filterReason,
      quality_score: isBot ? 0 : isSelfClick ? 10 : ipClickedLast24h ? 30 : 100,
    })
    .select("id")
    .single();

  if (!isUnique || !clickData?.id) return;

  await adminClient.rpc("increment_link_clicks", { link_id: args.linkId }).catch(() => {});
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

  const deviceType = detectDeviceType(userAgent);
  const browser = detectBrowser(userAgent);
  const os = detectOS(userAgent);

  // Extract geo from CDN/edge headers (Vercel, Cloudflare) — zero latency
  const cfCountry = request.headers.get("cf-ipcountry");
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  const vercelCity = request.headers.get("x-vercel-ip-city");
  const cfCity = request.headers.get("cf-ipcity");

  const edgeCountryCode = (cfCountry || vercelCountry || "").toUpperCase() || null;
  const edgeCountry = edgeCountryCode ? (CC_TO_COUNTRY[edgeCountryCode] || null) : null;
  const edgeCity = vercelCity ? decodeURIComponent(vercelCity) : cfCity || null;

  // Use edge headers if available (instant), otherwise skip geo for now (async later)
  const hasEdgeGeo = Boolean(edgeCountryCode && edgeCountry);
  const country = hasEdgeGeo ? edgeCountry : null;
  const countryCode = hasEdgeGeo ? edgeCountryCode : null;
  const city = hasEdgeGeo ? edgeCity : null;

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
    p_country: country,
    p_country_code: countryCode,
    p_city: city,
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

    // Fire-and-forget: log click with async geo resolution
    void (async () => {
      let geoCountry = country;
      let geoCountryCode = countryCode;
      let geoCity = city;
      if (!hasEdgeGeo && ip) {
        const geo = await resolveGeoIP(ip);
        geoCountry = geo.country;
        geoCountryCode = geo.countryCode;
        geoCity = geo.city;
      }
      await logClickFallbackAsync({
        linkId: fallbackLink.id,
        userId: fallbackLink.user_id,
        ip,
        country: geoCountry,
        countryCode: geoCountryCode,
        city: geoCity,
        userAgent,
        referer,
        deviceType,
        browser,
        os,
      });
    })();

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

  // If no edge geo headers available, enrich geo async after redirect
  if (clickEventId && !hasEdgeGeo && ip) {
    void enrichClickGeoAsync(clickEventId, ip);
  }

  return redirectResponse(destinationUrl);
}

