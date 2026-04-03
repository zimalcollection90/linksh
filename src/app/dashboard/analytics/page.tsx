import { createClient } from "../../../../supabase/server";
import AnalyticsClient from "./analytics-client";
import { redirect } from "next/navigation";

export default async function AnalyticsPage(props: { searchParams: Promise<{ range?: string; view?: string }> }) {
  const searchParams = await props.searchParams;
  const view = searchParams.view;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const isOwnView = view === "own";

  const range = searchParams.range || "30d";
  let days: number | null = 30;
  if (range === "today") days = 1;
  else if (range === "7d") days = 7;
  else if (range === "30d") days = 30;
  else if (range === "90d") days = 90;
  else if (range === "all") days = null;

  // Non-active non-admin → back to dashboard pending screen
  if (profile?.status !== "active" && !isAdmin) {
    redirect("/dashboard");
  }

  const userId = profile?.id ?? user.id;

  // targetUserId for RPCs: null means show all (for admins), userId means show specific
  const targetUserId = (isAdmin && !isOwnView) ? null : userId;

  // Admin sees all links (unless in own view); member sees own
  const { data: links } = (isAdmin && !isOwnView)
    ? await supabase
        .from("links")
        .select("id, title, short_code, click_count, status, created_at, user_id")
        .order("created_at", { ascending: false })
    : await supabase
        .from("links")
        .select("id, title, short_code, click_count, status, created_at, user_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

  const linkIds = (links || []).map((l) => l.id);

  // Use RPC for stats to ensure consistency with main dashboard
  const { data: statsData } = await supabase.rpc("get_dashboard_stats", { 
    p_user_id: targetUserId,
    p_days: days 
  });
  const stats = Array.isArray(statsData) ? statsData[0] : statsData;

  // Fetch geography via RPC
  const { data: geoRes } = await supabase.rpc("get_geography_stats", {
    p_user_id: targetUserId,
    p_days: days,
    p_limit: 15
  });

  // Keep direct table query for the detailed clicks list (last 1000)
  const clicksQuery = (isAdmin && !isOwnView)
    ? supabase
        .from("click_events")
        .select("id, link_id, country, country_code, device_type, browser, os, clicked_at, is_bot, is_filtered, is_unique")
        .eq("is_bot", false)
        .eq("is_filtered", false)
        .eq("is_unique", true)
        .order("clicked_at", { ascending: false })
        .limit(1000)
    : linkIds.length > 0
    ? supabase
        .from("click_events")
        .select("id, link_id, country, country_code, device_type, browser, os, clicked_at, is_bot, is_filtered, is_unique")
        .in("link_id", linkIds)
        .eq("is_bot", false)
        .eq("is_filtered", false)
        .eq("is_unique", true)
        .order("clicked_at", { ascending: false })
        .limit(1000)
    : null;

  const { data: clicks } = clicksQuery ? await clicksQuery : { data: [] };

  // Admin: fetch all users as members list for leaderboard context
  const { data: membersRes } = isAdmin 
    ? await supabase.rpc("get_members_with_stats_v3", { p_days: days, p_limit: 50 })
    : { data: [] };

  return (
    <AnalyticsClient
      links={links || []}
      clicks={clicks || []}
      isAdmin={isAdmin}
      members={membersRes || []}
      stats={stats}
      geoStats={geoRes || []}
      currentRange={range}
      view={isAdmin ? (isOwnView ? "own" : "all") : "own"}
    />
  );
}
