import { createClient } from "../../../../../supabase/server";
import { redirect, notFound } from "next/navigation";
import MemberAnalyticsClient from "./member-analytics-client";

function rolePriority(role?: string) {
  if (role === "super_admin") return 3;
  if (role === "admin") return 2;
  return 1;
}

export default async function MemberAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, role, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const activeMemberships = (memberships || []).filter((m: any) => m.status === "active");
  const membership = (activeMemberships.length > 0 ? activeMemberships : (memberships || []))
    .sort((a: any, b: any) => rolePriority(b.role) - rolePriority(a.role))[0];

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const effectiveMembership = membership || (profile?.role === "admin"
    ? { company_id: user.id, role: "admin", status: "active" }
    : null);

  const isAdmin =
    effectiveMembership?.role === "admin" ||
    effectiveMembership?.role === "super_admin" ||
    profile?.role === "admin";

  if (!isAdmin || effectiveMembership?.status !== "active") {
    return redirect("/dashboard");
  }

  // Fetch the member's profile
  const { data: memberProfile } = await supabase
    .from("users")
    .select("*")
    .eq("id", memberId)
    .single();

  if (!memberProfile) return notFound();

  // Fetch member's company membership info
  const { data: memberMembership } = await supabase
    .from("company_members")
    .select("*")
    .eq("company_id", effectiveMembership!.company_id)
    .eq("user_id", memberId)
    .single();

  // Fetch real click stats via RPC
  const { data: clickStatsData } = await supabase.rpc("get_user_click_stats", { p_user_id: memberId });
  const clickStats = clickStatsData?.[0] || { total_clicks: 0, real_clicks: 0, unique_users: 0, filtered_clicks: 0, bot_excluded: 0 };

  // Fetch daily clicks for chart (30 days)
  const { data: dailyClicksData } = await supabase.rpc("get_user_daily_clicks", { p_user_id: memberId, p_days: 30 });

  // Fetch member's links with per-link stats
  const { data: links } = await supabase
    .from("links")
    .select("*")
    .eq("user_id", memberId)
    .eq("company_id", effectiveMembership!.company_id)
    .order("click_count", { ascending: false })
    .limit(20);

  // Fetch recent click events for this member (with metadata)
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentClicks } = await supabase
    .from("click_events")
    .select("*, links(title, short_code)")
    .eq("user_id", memberId)
    .gte("clicked_at", thirtyDaysAgo.toISOString())
    .order("clicked_at", { ascending: false })
    .limit(200);

  // Country distribution
  const countryCounts: Record<string, number> = {};
  for (const c of recentClicks || []) {
    if (!c.country || c.is_bot || c.is_filtered) continue;
    countryCounts[c.country] = (countryCounts[c.country] || 0) + 1;
  }
  const countryData = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // Device distribution
  const deviceCounts: Record<string, number> = {};
  for (const c of recentClicks || []) {
    if (!c.device_type || c.is_bot || c.is_filtered) continue;
    deviceCounts[c.device_type] = (deviceCounts[c.device_type] || 0) + 1;
  }
  const deviceData = Object.entries(deviceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // Browser distribution
  const browserCounts: Record<string, number> = {};
  for (const c of recentClicks || []) {
    if (!c.browser || c.is_bot || c.is_filtered) continue;
    browserCounts[c.browser] = (browserCounts[c.browser] || 0) + 1;
  }
  const browserData = Object.entries(browserCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Earnings
  const { data: earnings } = await supabase
    .from("earnings")
    .select("amount, payment_status, created_at")
    .eq("user_id", memberId)
    .order("created_at", { ascending: false })
    .limit(10);

  const totalEarnings = (earnings || []).reduce((s, e: any) => s + (e.amount || 0), 0);

  return (
    <MemberAnalyticsClient
      member={{ ...memberProfile, ...memberMembership, membership_status: memberMembership?.status || memberProfile?.status }}
      clickStats={{
        totalClicks: Number(clickStats.total_clicks) || 0,
        realClicks: Number(clickStats.real_clicks) || 0,
        uniqueUsers: Number(clickStats.unique_users) || 0,
        filteredClicks: Number(clickStats.filtered_clicks) || 0,
        botExcluded: Number(clickStats.bot_excluded) || 0,
      }}
      dailyClicks={(dailyClicksData || []).map((d: any) => ({
        day: d.day,
        total: Number(d.total) || 0,
        real: Number(d.real_clicks) || 0,
        unique: Number(d.unique_users) || 0,
        bots: Number(d.bots) || 0,
      }))}
      links={links || []}
      countryData={countryData}
      deviceData={deviceData}
      browserData={browserData}
      earnings={earnings || []}
      totalEarnings={totalEarnings}
      companyId={effectiveMembership!.company_id}
    />
  );
}
