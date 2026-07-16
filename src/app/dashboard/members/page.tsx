import { createClient } from "../../../../supabase/server";
import { createAdminClient } from "../../../../supabase/admin";
import { redirect } from "next/navigation";
import MembersClient from "./members-client";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  // Only admins can access this page. We do NOT require status==="active" for admins
  // because a super_admin could themselves have any status and should always have access.
  if (!isAdmin) {
    return redirect("/dashboard");
  }

  // Use the admin client (which bypasses RLS) to query all members and their aggregated stats
  const adminSupabase = createAdminClient();

  // Use the optimised RPC that aggregates stats server-side (avoids fetching 50k click rows)
  const { data: membersData } = await adminSupabase.rpc("get_members_with_stats_v3", {
    p_limit: 200,
    p_days: null, // all-time stats
  });

  // Fetch base user profile fields the RPC doesn't return (avatar, ip, dates, goal, etc.)
  const { data: users } = await adminSupabase
    .from("users")
    .select("id, full_name, display_name, email, avatar_url, status, role, created_at, last_active_at, last_seen_ip, monthly_click_goal")
    .order("created_at", { ascending: false });

  // Merge RPC stats into the user list
  const statsByUser: Record<string, any> = {};
  for (const m of membersData || []) {
    statsByUser[m.id] = m;
  }

  const membersWithStats = (users || []).map((u: any) => {
    const stats = statsByUser[u.id] || {};
    return {
      ...u,
      role: u.role || "member",
      status: u.status || "pending",
      totalClicks: Number(stats.total_clicks) || 0,
      linkCount: Number(stats.link_count) || 0,
      realClicks: Number(stats.real_clicks) || 0,
      uniqueUsers: Number(stats.unique_users) || 0,
      botExcluded: Number(stats.bot_excluded) || 0,
      filteredClicks: Number(stats.filtered_clicks) || 0,
    };
  });

  return <MembersClient members={membersWithStats} />;
}

