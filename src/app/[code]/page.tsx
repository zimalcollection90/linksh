import { createClient } from "../../../supabase/server";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";

export default async function RedirectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Skip tempobook routes and known Next.js paths
  if (
    code.startsWith("tempobook") ||
    code.startsWith("dashboard") ||
    code.startsWith("sign-in") ||
    code.startsWith("sign-up") ||
    code.startsWith("forgot-password") ||
    code.startsWith("u") ||
    code.startsWith("_next") ||
    code.startsWith("api") ||
    code.startsWith("favicon")
  ) {
    return notFound();
  }

  const supabase = await createClient();

  const { data: link } = await supabase
    .from("links")
    .select("*")
    .eq("short_code", code)
    .eq("status", "active")
    .single();

  if (!link) return notFound();

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await supabase.from("links").update({ status: "expired" }).eq("id", link.id);
    return notFound();
  }

  // Log click asynchronously
  try {
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const referer = headersList.get("referer") || null;
    const forwardedFor = headersList.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0]?.trim() || null;

    // Simple device detection
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
    const isBot = /bot|crawler|spider|crawl|scraper/i.test(userAgent);

    let browser = "Unknown";
    if (/chrome/i.test(userAgent) && !/edge|edg/i.test(userAgent)) browser = "Chrome";
    else if (/firefox/i.test(userAgent)) browser = "Firefox";
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";
    else if (/edge|edg/i.test(userAgent)) browser = "Edge";
    else if (/opera|opr/i.test(userAgent)) browser = "Opera";

    let os = "Unknown";
    if (/windows/i.test(userAgent)) os = "Windows";
    else if (/mac os/i.test(userAgent)) os = "macOS";
    else if (/linux/i.test(userAgent)) os = "Linux";
    else if (/android/i.test(userAgent)) os = "Android";
    else if (/ios|iphone|ipad/i.test(userAgent)) os = "iOS";

    await supabase.from("click_events").insert({
      link_id: link.id,
      user_id: link.user_id,
      ip_address: ip,
      device_type: isMobile ? "mobile" : "desktop",
      browser,
      os,
      referrer: referer,
      user_agent: userAgent,
      is_bot: isBot,
      quality_score: isBot ? 0 : 100,
    });

    // Increment click count
    await supabase.rpc("increment_link_clicks", { link_id: link.id });
  } catch (e) {
    // Silent fail — redirect must always work
  }

  redirect(link.destination_url);
}
