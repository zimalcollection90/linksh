import { createClient } from "../../../supabase/server";
import AdminDashboard from "./components/admin-dashboard";
import MemberDashboard from "./components/member-dashboard";
import Link from "next/link";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const userId = profile?.id;

  if (profile?.status !== "active" && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto mt-16 rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Account pending approval</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your account is waiting for admin approval. You can sign in, but link creation and analytics are locked until your status is active.
        </p>
        <div className="mt-4">
          <Link href="/dashboard/settings" className="text-sm text-primary hover:underline">
            Open settings
          </Link>
        </div>
      </div>
    );
  }

  let totalLinks = 0, totalClicks = 0, activeMembers = 0;
  let realClicks = 0, uniqueUsers = 0, filteredClicks = 0, botExcluded = 0;
  let heatmapData: Array<{ code: string; value: number }> = [];
  let trendData: Array<{ date: string; clicks: number; earnings: number }> = [];

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
      supabase
        .from("links")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("links")
        .select("click_count")
        .eq("user_id", userId),
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
    .order("clicked_at", { ascending: false })
      .limit(2000);

    const counts: Record<string, number> = {};
    for (const row of heatmapClicks || []) {
      const code = row?.country_code?.toString().toUpperCase();
      if (!code) continue;
      counts[code] = (counts[code] || 0) + 1;
    }

    heatmapData = Object.entries(counts).map(([code, value]) => ({ code, value }));

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 13);

    const { data: trendClicks } = await supabase
      .from("click_events")
      .select("clicked_at")
      .gte("clicked_at", start.toISOString())
      .order("clicked_at", { ascending: true })
      .limit(5000);

    const dayCounts: Record<string, number> = {};
    for (const row of trendClicks || []) {
      const ts = row?.clicked_at ? new Date(row.clicked_at) : null;
      if (!ts) continue;
      const key = ts.toISOString().slice(0, 10);
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    }

    trendData = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { date: label, clicks: dayCounts[key] || 0, earnings: 0 };
    });
  }

  let topMembers: any[] = [];
  if (isAdmin) {
    const { data: members } = await supabase
      .from("users")
      .select("id, user_id, full_name, display_name, email, avatar_url, status, role")
      .order("created_at", { ascending: false })
      .limit(8);
    const clickStatsByUser: Record<string, any> = {};
    const memberIds = (members || []).map((m: any) => m.id);
    const { data: memberClicks } = memberIds.length
      ? await supabase.from("click_events").select("user_id, is_bot, is_filtered").in("user_id", memberIds).limit(50000)
      : { data: [] as any[] };
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
            botExcluded: Number(clickStatsByUser[m.id]?.bot_excluded) || 0,
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
      />
    );
  }

  return (
    <MemberDashboard
      stats={stats}
      recentLinks={recentLinks || []}
      profile={profile}
    />
  );
}
