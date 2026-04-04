import { createClient } from "../../../supabase/server";
import AdminDashboard from "./components/admin-dashboard";
import MemberDashboard from "./components/member-dashboard";
import Link from "next/link";
import { Clock, ShieldOff } from "lucide-react";
import { getCountryName } from "@/utils/geo";

export default async function Dashboard(props: { searchParams: Promise<{ range?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const userId = profile?.id;
  const status = profile?.status ?? "pending";

  const range = searchParams.range || "30d";
  let days: number | null = 30;
  if (range === "today") days = 1;
  else if (range === "7d") days = 7;
  else if (range === "30d") days = 30;
  else if (range === "90d") days = 90;
  else if (range === "all") days = null;

  // Pending users — show waiting screen
  if (status === "pending" && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full mx-auto rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
            Waiting for Admin Approval
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account has been created and is pending review. An admin will approve
            your account shortly. You can sign in but link creation and analytics are
            locked until you&apos;re approved.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Status: Pending Approval</span>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/settings" className="text-xs text-muted-foreground hover:text-primary underline underline-offset-4">
              Update profile settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Suspended users — show blocked screen
  if (status === "suspended" && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
            Account Suspended
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account has been suspended by an administrator. You cannot create links
            or access analytics. Please contact support if you believe this is a mistake.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-red-400">
            <ShieldOff className="w-3.5 h-3.5" />
            <span>Status: Suspended</span>
          </div>
        </div>
      </div>
    );
  }

  let totalLinks = 0, totalClicks = 0, activeMembers = 0, totalEarnings = 0;
  let realClicks = 0, uniqueUsers = 0, filteredClicks = 0, botExcluded = 0, facebookScrapers = 0;
  let heatmapData: Array<{ code: string; value: number }> = [];
  let trendData: Array<{ date: string; clicks: number; earnings: number }> = [];
  let topCountries: Array<{ country: string; country_code: string; click_count: number }> = [];
  let topMembers: any[] = [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  if (isAdmin) {
    // 1. Fetch Admin Stats via unified RPC
    const { data: adminStatsData } = await supabase.rpc("get_dashboard_stats", { p_days: days });
    const adminStats = Array.isArray(adminStatsData) ? adminStatsData[0] : adminStatsData;
    if (adminStats) {
      totalLinks = Number(adminStats.total_links) || 0;
      totalClicks = Number(adminStats.total_clicks) || 0;
      activeMembers = Number(adminStats.active_members) || 0;
      realClicks = Number(adminStats.real_clicks) || 0;
      uniqueUsers = Number(adminStats.unique_users) || 0;
      filteredClicks = Number(adminStats.filtered_clicks) || 0;
      botExcluded = Number(adminStats.bot_excluded) || 0;
      facebookScrapers = Number(adminStats.facebook_scrapers) || 0;
      totalEarnings = Number(adminStats.total_earnings) || 0;
    }

    // 2. Fetch Top Countries via optimized RPC
    const { data: geoRes } = await supabase.rpc("get_geography_stats", { p_limit: 15, p_days: days });
    topCountries = (geoRes || []).map((row: any) => ({
      country: row.country,
      country_code: (row.country_code || "").toUpperCase(),
      click_count: Number(row.click_count) || 0
    }));

    heatmapData = (geoRes || []).map((row: any) => ({
      code: (row.country_code || "").toUpperCase(),
      value: Number(row.click_count) || 0
    }));

    // 3. Fetch Trend Data via optimized RPC
    const { data: trendRes } = await supabase.rpc("get_trend_stats", { p_days: days || 30 });
    trendData = (trendRes || []).map((row: any) => ({
      date: new Date(row.date_label).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      clicks: Number(row.click_count) || 0,
      earnings: parseFloat(Number(row.earning_amount || 0).toFixed(2))
    }));

    // 4. Fetch Top Members with Stats via updated RPC
    const { data: membersRes } = await supabase.rpc("get_members_with_stats_v3", { p_limit: 8, p_days: days });
    topMembers = (membersRes || []).map((m: any) => ({
      ...m,
      displayName: m.display_name || m.full_name || m.email?.split("@")[0] || "Member",
      totalClicks: Number(m.total_clicks) || 0,
      linkCount: Number(m.link_count) || 0,
      realClicks: Number(m.real_clicks) || 0
    }));

  } else {
    // Member Dashboard path
    const [memberStatsRes, geoRes, trendRes, linksCountRes] = await Promise.all([
      supabase.rpc("get_dashboard_stats", { p_user_id: userId, p_days: days }),
      supabase.rpc("get_geography_stats", { p_user_id: userId, p_limit: 10, p_days: days }),
      supabase.rpc("get_trend_stats", { p_user_id: userId, p_days: days || 30 }),
      supabase.from("links").select("id", { count: "exact", head: true }).eq("user_id", userId)
    ]);

    totalLinks = linksCountRes.count || 0;
    
    if (memberStatsRes.data && memberStatsRes.data[0]) {
      const ms = memberStatsRes.data[0];
      totalClicks = Number(ms.total_clicks) || 0;
      realClicks = Number(ms.real_clicks) || 0;
      uniqueUsers = Number(ms.unique_users) || 0;
      filteredClicks = Number(ms.filtered_clicks) || 0;
      botExcluded = Number(ms.bot_excluded) || 0;
      facebookScrapers = Number(ms.facebook_scrapers) || 0;
      totalEarnings = Number(ms.total_earnings) || 0;
    }

    topCountries = (geoRes.data || []).map((row: any) => ({
      country: row.country,
      country_code: (row.country_code || "").toUpperCase(),
      click_count: Number(row.click_count) || 0
    }));

    trendData = (trendRes.data || []).map((row: any) => ({
      date: new Date(row.date_label).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      clicks: Number(row.click_count) || 0,
      earnings: parseFloat(Number(row.earning_amount || 0).toFixed(2))
    }));
  }

  // Common fetches (Recent Activities)
  const recentLinksQuery = isAdmin
    ? supabase
        .from("links")
        .select("*, users(full_name, display_name, email)")
        .order("created_at", { ascending: false })
        .limit(5)
    : supabase
        .from("links")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

  const { data: recentLinks } = await recentLinksQuery;

  const { data: recentClicks } = await supabase
    .from("click_events")
    .select("*, links(title, short_code)")
    .eq("is_bot", false)
    .eq("is_filtered", false)
    .eq("is_unique", true)
    .order("clicked_at", { ascending: false })
    .limit(10);

  const memberRecentClicks = !isAdmin && userId
    ? (recentClicks || []).filter((c: any) => c.user_id === userId)
    : recentClicks;

  const stats = { 
    totalLinks, 
    totalClicks: realClicks, 
    activeMembers, 
    totalEarnings, 
    realClicks, 
    uniqueUsers, 
    filteredClicks,
    botExcluded, 
    facebookScrapers 
  };

  // Monthly Goal logic
  const [goalRes, monthlyClicksRes] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "monthly_click_goal").single(),
    !isAdmin && userId 
      ? supabase.from("click_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("clicked_at", monthStart)
          .eq("is_bot", false)
          .eq("is_filtered", false)
      : Promise.resolve({ count: 0 })
  ]);

  const globalGoal = parseInt(goalRes.data?.value || "1000");
  const monthlyGoal = profile?.monthly_click_goal && profile.monthly_click_goal > 0
    ? profile.monthly_click_goal
    : globalGoal;
  const monthlyClicks = monthlyClicksRes.count || 0;


  if (isAdmin) {
    return (
      <AdminDashboard
        stats={stats}
        recentLinks={recentLinks || []}
        recentClicks={memberRecentClicks || []}
        topMembers={topMembers}
        profile={profile}
        heatmapData={heatmapData}
        trendData={trendData}
        monthlyGoal={monthlyGoal}
        topCountries={topCountries}
        currentRange={range}
      />
    );
  }

  return (
    <MemberDashboard
      stats={stats}
      recentLinks={recentLinks || []}
      profile={profile}
      trendData={trendData}
      monthlyGoal={monthlyGoal}
      monthlyClicks={monthlyClicks}
      topCountries={topCountries}
      currentRange={range}
    />
  );
}

