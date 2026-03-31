import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../supabase/admin";
import { createClient } from "../../../../../supabase/server";
import { getApiContext, requireActiveMembership } from "../../_lib/api-auth";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext(req);
  requireActiveMembership(ctx);
  const supabase = ctx.authMode === "api_key" ? createAdminClient() : await createClient();

  const linksQuery = supabase.from("links").select("id, click_count, user_id");
  const earningsQuery = supabase.from("earnings").select("amount, user_id");
  const clickEventsQuery = supabase
    .from("click_events")
    .select("clicked_at, country, device_type, browser, is_bot, is_filtered, is_unique, user_id")
    .order("clicked_at", { ascending: false })
    .limit(50000);
  const membersQuery = supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "active");

  if (ctx.role === "member") {
    linksQuery.eq("user_id", ctx.userId);
    earningsQuery.eq("user_id", ctx.userId);
    clickEventsQuery.eq("user_id", ctx.userId);
  }

  const [linksRes, earningsRes, membersRes, clicksRes] = await Promise.all([
    linksQuery,
    earningsQuery,
    membersQuery,
    clickEventsQuery,
  ]);

  if (linksRes.error) return NextResponse.json({ error: linksRes.error.message }, { status: 400 });
  if (earningsRes.error) return NextResponse.json({ error: earningsRes.error.message }, { status: 400 });
  if (membersRes.error) return NextResponse.json({ error: membersRes.error.message }, { status: 400 });
  if (clicksRes.error) return NextResponse.json({ error: clicksRes.error.message }, { status: 400 });

  const totalLinks = (linksRes.data || []).length;
  const totalClicks = (linksRes.data || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
  const totalEarnings = (earningsRes.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const activeMembers = (membersRes.data || []).length;
  const realClicks = (clicksRes.data || []).filter((c: any) => !c.is_bot && !c.is_filtered).length;
  const uniqueUsers = (clicksRes.data || []).filter((c: any) => !!c.is_unique).length;
  const filteredClicks = (clicksRes.data || []).filter((c: any) => !!c.is_filtered).length;
  const botExcluded = (clicksRes.data || []).filter((c: any) => !!c.is_bot).length;

  const now = new Date();
  const dayCutoff = new Date(now);
  dayCutoff.setDate(dayCutoff.getDate() - 1);
  const weekCutoff = new Date(now);
  weekCutoff.setDate(weekCutoff.getDate() - 7);
  const monthCutoff = new Date(now);
  monthCutoff.setMonth(monthCutoff.getMonth() - 1);

  const periods = {
    daily: (clicksRes.data || []).filter((c: any) => new Date(c.clicked_at) >= dayCutoff),
    weekly: (clicksRes.data || []).filter((c: any) => new Date(c.clicked_at) >= weekCutoff),
    monthly: (clicksRes.data || []).filter((c: any) => new Date(c.clicked_at) >= monthCutoff),
  } as Record<string, any[]>;

  const periodStats = Object.fromEntries(
    Object.entries(periods).map(([k, rows]) => [
      k,
      {
        realClicks: rows.filter((r) => !r.is_bot && !r.is_filtered).length,
        uniqueUsers: rows.filter((r) => !!r.is_unique).length,
        filteredClicks: rows.filter((r) => !!r.is_filtered).length,
      },
    ])
  );

  const countryMap: Record<string, number> = {};
  const deviceMap: Record<string, number> = {};
  const browserMap: Record<string, number> = {};
  for (const c of clicksRes.data || []) {
    if (c.is_bot || c.is_filtered) continue;
    if (c.country) countryMap[c.country] = (countryMap[c.country] || 0) + 1;
    if (c.device_type) deviceMap[c.device_type] = (deviceMap[c.device_type] || 0) + 1;
    if (c.browser) browserMap[c.browser] = (browserMap[c.browser] || 0) + 1;
  }

  const countryBreakdown = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, value]) => ({ name, value }));
  const deviceBreakdown = Object.entries(deviceMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  const browserBreakdown = Object.entries(browserMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  return NextResponse.json({
    stats: {
      totalLinks,
      totalClicks,
      totalEarnings,
      activeMembers,
      realClicks,
      uniqueUsers,
      filteredClicks,
      botExcluded,
    },
    trends: periodStats,
    countryBreakdown,
    deviceBreakdown,
    browserBreakdown,
  });
}

