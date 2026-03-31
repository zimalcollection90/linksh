import { createClient } from "../../../supabase/server";
import AdminDashboard from "./components/admin-dashboard";
import MemberDashboard from "./components/member-dashboard";
import Link from "next/link";

function rolePriority(role?: string) {
  if (role === "super_admin") return 3;
  if (role === "admin") return 2;
  return 1;
}

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: activeMemberships } = await supabase
    .from("company_members")
    .select("company_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  let effectiveMembership = (activeMemberships || []).sort((a: any, b: any) => rolePriority(b.role) - rolePriority(a.role))[0];
  if (!effectiveMembership) {
    const { data: anyMemberships } = await supabase
      .from("company_members")
      .select("company_id, role, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    effectiveMembership = (anyMemberships || []).sort((a: any, b: any) => rolePriority(b.role) - rolePriority(a.role))[0];
  }

  if (!effectiveMembership) {
    // Self-heal: if legacy profile marks user as admin but membership rows are missing,
    // bootstrap a personal company + active membership so dashboard can load.
    if (profile?.role === "admin") {
      const { error: bootstrapError } = await supabase.rpc("bootstrap_admin_membership_for_self");
      // If RPC is missing (migration not applied yet), continue with a virtual
      // admin membership so dashboard remains accessible.
      if (bootstrapError) {
        effectiveMembership = {
          company_id: user.id,
          role: "admin",
          status: "active",
        };
      }

      if (!bootstrapError) {
        const { data: fixedMemberships } = await supabase
          .from("company_members")
          .select("company_id, role, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false });
        effectiveMembership = (fixedMemberships || []).sort((a: any, b: any) => rolePriority(b.role) - rolePriority(a.role))[0];
        if (!effectiveMembership) {
          effectiveMembership = {
            company_id: user.id,
            role: "admin",
            status: "active",
          };
        }
      }
    } else {
      return (
        <div className="max-w-xl mx-auto mt-16 rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold">No company membership found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your account is missing a company membership. Ask an admin to invite or activate your account.
          </p>
        </div>
      );
    }
  }

  const isAdmin =
    effectiveMembership.role === "admin" ||
    effectiveMembership.role === "super_admin" ||
    profile?.role === "admin";
  const userId = profile?.id;

  if (effectiveMembership.status !== "active") {
    return (
      <div className="max-w-xl mx-auto mt-16 rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Account pending approval</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your account is waiting for admin approval. You can sign in, but link creation and analytics are locked until your membership is active.
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
    const [linksRes, clicksRes, membersRes, realClicksRes] = await Promise.all([
      supabase.from("links").select("id", { count: "exact", head: true }).eq("company_id", effectiveMembership.company_id),
      supabase.from("links").select("click_count").eq("company_id", effectiveMembership.company_id),
      supabase
        .from("company_members")
        .select("id", { count: "exact", head: true })
        .eq("company_id", effectiveMembership.company_id)
        .eq("status", "active"),
      supabase.rpc("get_company_click_stats", { p_company_id: effectiveMembership.company_id }),
    ]);
    totalLinks = linksRes.count || 0;
    totalClicks = (clicksRes.data || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
    activeMembers = membersRes.count || 0;
    if (realClicksRes.data && realClicksRes.data[0]) {
      const rs = realClicksRes.data[0];
      realClicks = Number(rs.real_clicks) || 0;
      uniqueUsers = Number(rs.unique_users) || 0;
      filteredClicks = Number(rs.filtered_clicks) || 0;
      botExcluded = Number(rs.bot_excluded) || 0;
    }
  } else {
    const [linksRes, myLinksRes, realClicksRes] = await Promise.all([
      supabase
        .from("links")
        .select("id", { count: "exact", head: true })
        .eq("company_id", effectiveMembership.company_id)
        .eq("user_id", userId),
      supabase
        .from("links")
        .select("click_count")
        .eq("company_id", effectiveMembership.company_id)
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
        .eq("company_id", effectiveMembership.company_id)
        .order("created_at", { ascending: false })
        .limit(5)
    : supabase
        .from("links")
        .select("*")
        .eq("company_id", effectiveMembership.company_id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

  const { data: recentLinks } = await recentLinksQuery;

  const { data: recentClicks } = await supabase
    .from("click_events")
    .select("*, links(title, short_code)")
    .eq("company_id", effectiveMembership.company_id)
    .order("clicked_at", { ascending: false })
    .limit(10);

  if (isAdmin) {
    const { data: heatmapClicks } = await supabase
      .from("click_events")
      .select("country_code")
      .eq("company_id", effectiveMembership.company_id)
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
      .eq("company_id", effectiveMembership.company_id)
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
    const { data: companyMembers } = await supabase
      .from("company_members")
      .select("user_id, role, status")
      .eq("company_id", effectiveMembership.company_id)
      .order("created_at", { ascending: false })
      .limit(8);
    const ids = (companyMembers || []).map((m) => m.user_id);
    const { data: members } = ids.length
      ? await supabase
          .from("users")
          .select("id, full_name, display_name, email, avatar_url, status")
          .in("id", ids)
      : { data: [] as any[] };

    // Fetch real click stats per member
    const { data: memberClickStats } = await supabase.rpc("get_member_stats_for_company", {
      p_company_id: effectiveMembership.company_id,
    });
    const clickStatsByUser: Record<string, any> = {};
    for (const s of memberClickStats || []) {
      clickStatsByUser[s.user_id] = s;
    }

    if (members) {
      const memberById: Record<string, any> = {};
      for (const m of companyMembers || []) memberById[m.user_id] = m;
      const membersWithStats = await Promise.all(
        members.map(async (m: any) => {
          const { data: links } = await supabase
            .from("links")
            .select("click_count")
            .eq("company_id", effectiveMembership.company_id)
            .eq("user_id", m.id);
          const clicks = (links || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
          return {
            ...m,
            role: memberById[m.id]?.role || "member",
            status: memberById[m.id]?.status || m.status,
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
    ? supabase.from("earnings").select("amount").eq("company_id", effectiveMembership.company_id)
    : supabase.from("earnings").select("amount").eq("company_id", effectiveMembership.company_id).eq("user_id", userId);
  const { data: earningsData } = await earningsQuery;
  const totalEarnings = (earningsData || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);

  const stats = { totalLinks, totalClicks, activeMembers, totalEarnings, realClicks, uniqueUsers, filteredClicks, botExcluded };

  if (isAdmin) {
    return (
      <AdminDashboard
        stats={stats}
        recentLinks={recentLinks || []}
        recentClicks={recentClicks || []}
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
