import { createClient } from "../../../supabase/server";
import AdminDashboard from "./components/admin-dashboard";
import MemberDashboard from "./components/member-dashboard";
import Link from "next/link";
import { Clock, ShieldOff } from "lucide-react";

export default async function Dashboard() {
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

  let totalLinks = 0, totalClicks = 0, activeMembers = 0;
  let realClicks = 0, uniqueUsers = 0, filteredClicks = 0, botExcluded = 0;
  let heatmapData: Array<{ code: string; value: number }> = [];
  let trendData: Array<{ date: string; clicks: number; earnings: number }> = [];
  let topCountries: Array<{ country: string; country_code: string; click_count: number }> = [];

  if (isAdmin) {
    const [linksRes, clicksRes, membersRes, clickEventsRes] = await Promise.all([
      supabase.from("links").select("id", { count: "exact", head: true }),
      supabase.from("links").select("click_count"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("click_events").select("is_bot, is_filtered, is_unique").limit(50000),
    ]);
    totalLinks = linksRes.count || 0;
    totalClicks = (clicksRes.data || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
    activeMembers = membersRes.count || 0;
    for (const e of clickEventsRes.data || []) {
      if (e.is_bot) botExcluded += 1;
      if (e.is_filtered) filteredClicks += 1;
      if (!e.is_bot && !e.is_filtered) realClicks += 1;
      if (e.is_unique) uniqueUsers += 1;
    }
  } else {
    const [linksRes, myLinksRes, realClicksRes] = await Promise.all([
      supabase.from("links").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("links").select("click_count").eq("user_id", userId),
      userId ? supabase.rpc("get_user_click_stats", { p_user_id: userId }) : Promise.resolve({ data: null }),
    ]);
    totalLinks = linksRes.count || 0;
    totalClicks = (myLinksRes.data || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
    if (realClicksRes.data && realClicksRes.data[0]) {
      const rs = realClicksRes.data[0];
      realClicks = Number(rs.real_clicks) || 0;
      uniqueUsers = Number(rs.unique_users) || 0;
      filteredClicks = Number(rs.filtered_clicks) || 0;
      botExcluded = Number(rs.bot_excluded) || 0;
    }

    // Fetch top countries for member
    if (userId) {
      const { data: memberCountryClicks } = await supabase
        .from("click_events")
        .select("country, country_code")
        .eq("user_id", userId)
        .eq("is_bot", false)
        .eq("is_filtered", false)
        .eq("is_unique", true)
        .not("country", "is", null)
        .neq("country", "Unknown")
        .limit(5000);

      const countryCounts: Record<string, { country: string; country_code: string; click_count: number }> = {};
      for (const row of memberCountryClicks || []) {
        const name = row.country;
        const code = (row.country_code || "").toUpperCase();
        if (!name || name.toLowerCase() === "unknown") continue;
        const validCode = code.length === 2 && code !== "XX" ? code : "";
        const key = validCode || name;
        if (!countryCounts[key]) countryCounts[key] = { country: name, country_code: validCode, click_count: 0 };
        countryCounts[key].click_count++;
      }
      topCountries = Object.values(countryCounts)
        .filter(c => c.country && c.country.toLowerCase() !== "unknown")
        .sort((a, b) => b.click_count - a.click_count)
        .slice(0, 10);
    }
  }

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
    .order("clicked_at", { ascending: false })
    .limit(10);

  const memberRecentClicks = !isAdmin && userId
    ? (recentClicks || []).filter((c: any) => c.user_id === userId)
    : recentClicks;

  if (isAdmin) {
    const { data: heatmapClicks } = await supabase
      .from("click_events")
      .select("country_code")
      .not("country_code", "is", null)
      .eq("is_bot", false)
      .eq("is_filtered", false)
      .order("clicked_at", { ascending: false })
      .limit(5000);

    const counts: Record<string, number> = {};
    for (const row of heatmapClicks || []) {
      const code = row?.country_code?.toString().toUpperCase().trim();
      if (!code || code === "XX" || code === "UN" || code.toLowerCase() === "unknown" || code.length !== 2) continue;
      counts[code] = (counts[code] || 0) + 1;
    }
    heatmapData = Object.entries(counts).map(([code, value]) => ({ code, value }));
  }

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 13);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let trendQuery = supabase
    .from("click_events")
    .select("clicked_at")
    .eq("is_bot", false)
    .eq("is_filtered", false)
    .gte("clicked_at", start.toISOString())
    .order("clicked_at", { ascending: true })
    .limit(5000);

  if (!isAdmin && userId) {
    trendQuery = trendQuery.eq("user_id", userId);
  }

  const { data: trendClicks } = await trendQuery;
  const dayCounts: Record<string, number> = {};
  for (const row of trendClicks || []) {
    const ts = row?.clicked_at ? new Date(row.clicked_at) : null;
    if (!ts) continue;
    const key = ts.toISOString().slice(0, 10);
    dayCounts[key] = (dayCounts[key] || 0) + 1;
  }

  let trendEarningsQuery = supabase
    .from("earnings")
    .select("created_at, amount")
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: true })
    .limit(5000);

  if (!isAdmin && userId) {
    trendEarningsQuery = trendEarningsQuery.eq("user_id", userId);
  }

  const { data: trendEarnings } = await trendEarningsQuery;
  const dayEarnings: Record<string, number> = {};
  for (const row of trendEarnings || []) {
    const ts = row?.created_at ? new Date(row.created_at) : null;
    if (!ts) continue;
    const key = ts.toISOString().slice(0, 10);
    dayEarnings[key] = (dayEarnings[key] || 0) + Number(row.amount || 0);
  }

  trendData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { 
      date: label, 
      clicks: dayCounts[key] || 0, 
      earnings: parseFloat((dayEarnings[key] || 0).toFixed(2)) 
    };
  });

  let topMembers: any[] = [];

  if (isAdmin) {
    // Fetch top countries for admin — direct query for platform-wide data
    const { data: countryClicks } = await supabase
      .from("click_events")
      .select("country, country_code")
      .eq("is_bot", false)
      .eq("is_filtered", false)
      .eq("is_unique", true)
      .not("country", "is", null)
      .neq("country", "Unknown")
      .limit(20000);

    const countryCounts: Record<string, { country: string; country_code: string; click_count: number }> = {};
    for (const row of countryClicks || []) {
      const name = row.country;
      const code = (row.country_code || "").toUpperCase();
      // Skip unknown / invalid entries
      if (!name || name.toLowerCase() === "unknown") continue;
      const validCode = code.length === 2 && code !== "XX" ? code : "";
      const key = validCode || name;
      if (!countryCounts[key]) countryCounts[key] = { country: name, country_code: validCode, click_count: 0 };
      countryCounts[key].click_count++;
    }
    topCountries = Object.values(countryCounts)
      .filter(c => c.country && c.country.toLowerCase() !== "unknown")
      .sort((a, b) => b.click_count - a.click_count)
      .slice(0, 15);

    const { data: members } = await supabase
      .from("users")
      .select("id, full_name, display_name, email, avatar_url, status, role")
      .order("created_at", { ascending: false })
      .limit(8);

    const memberIds = (members || []).map((m: any) => m.id);
    const { data: memberClicks } = memberIds.length
      ? await supabase.from("click_events").select("user_id, is_bot, is_filtered").in("user_id", memberIds).limit(50000)
      : { data: [] as any[] };

    const clickStatsByUser: Record<string, any> = {};
    for (const c of memberClicks || []) {
      if (!c.user_id) continue;
      const bucket = clickStatsByUser[c.user_id] || { real_clicks: 0 };
      if (!c.is_bot && !c.is_filtered) bucket.real_clicks += 1;
      clickStatsByUser[c.user_id] = bucket;
    }

    if (members) {
      const membersWithStats = await Promise.all(
        members.map(async (m: any) => {
          const { data: links } = await supabase
            .from("links")
            .select("click_count")
            .eq("user_id", m.id);
          const clicks = (links || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
          return {
            ...m,
            role: m.role || "member",
            status: m.status || "pending",
            totalClicks: clicks,
            linkCount: links?.length || 0,
            realClicks: Number(clickStatsByUser[m.id]?.real_clicks) || 0,
          };
        })
      );
      topMembers = membersWithStats;
    }
  }

  const earningsQuery = isAdmin
    ? supabase.from("earnings").select("amount")
    : supabase.from("earnings").select("amount").eq("user_id", userId);
  const { data: earningsData } = await earningsQuery;
  const totalEarnings = (earningsData || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const stats = { totalLinks, totalClicks, activeMembers, totalEarnings, realClicks, uniqueUsers, filteredClicks, botExcluded };

  // Fetch monthly goal and monthly clicks for progress bar
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

  const monthlyGoal = parseInt(goalRes.data?.value || "1000");
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
    />
  );
}
