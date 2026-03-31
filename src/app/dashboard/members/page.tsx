import { createClient } from "../../../../supabase/server";
import { redirect } from "next/navigation";
import MembersClient from "./members-client";

function rolePriority(role?: string) {
  if (role === "super_admin") return 3;
  if (role === "admin") return 2;
  return 1;
}

export default async function MembersPage() {
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

  const { data: companyMembers } = await supabase
    .from("company_members")
    .select("user_id, role, status, created_at")
    .eq("company_id", effectiveMembership.company_id)
    .order("created_at", { ascending: false });

  const memberIds = (companyMembers || []).map((m) => m.user_id);
  const { data: members } = await supabase
    .from("users")
    .select("id, full_name, display_name, email, avatar_url, status, role, created_at, earnings_rate, last_active_at, last_seen_ip")
    .in("id", memberIds);

  const { data: invites } = await supabase
    .from("invites")
    .select("*")
    .eq("company_id", effectiveMembership.company_id)
    .order("created_at", { ascending: false });

  const { data: links } = await supabase
    .from("links")
    .select("user_id, click_count")
    .eq("company_id", effectiveMembership.company_id);
  const { data: earnings } = await supabase
    .from("earnings")
    .select("user_id, amount")
    .eq("company_id", effectiveMembership.company_id);

  // Fetch real click stats per member using RPC
  const { data: memberClickStats } = await supabase.rpc("get_member_stats_for_company", {
    p_company_id: effectiveMembership.company_id,
  });

  const clickStatsByUser: Record<string, any> = {};
  for (const s of memberClickStats || []) {
    clickStatsByUser[s.user_id] = s;
  }

  const membershipById: Record<string, any> = {};
  for (const m of companyMembers || []) membershipById[m.user_id] = m;

  const linkStats: Record<string, { linkCount: number; totalClicks: number }> = {};
  for (const l of links || []) {
    if (!l.user_id) continue;
    linkStats[l.user_id] = linkStats[l.user_id] || { linkCount: 0, totalClicks: 0 };
    linkStats[l.user_id].linkCount += 1;
    linkStats[l.user_id].totalClicks += l.click_count || 0;
  }

  const earningStats: Record<string, number> = {};
  for (const e of earnings || []) {
    if (!e.user_id) continue;
    earningStats[e.user_id] = (earningStats[e.user_id] || 0) + (e.amount || 0);
  }

  const membersWithStats = (members || []).map((m: any) => ({
    ...m,
    role: membershipById[m.id]?.role || "member",
    status: membershipById[m.id]?.status || "pending",
    created_at: membershipById[m.id]?.created_at || m.created_at,
    totalClicks: linkStats[m.id]?.totalClicks || 0,
    linkCount: linkStats[m.id]?.linkCount || 0,
    totalEarnings: earningStats[m.id] || 0,
    realClicks: Number(clickStatsByUser[m.id]?.real_clicks) || 0,
    uniqueUsers: Number(clickStatsByUser[m.id]?.unique_users) || 0,
    botExcluded: Number(clickStatsByUser[m.id]?.bot_excluded) || 0,
    filteredClicks: Number(clickStatsByUser[m.id]?.filtered_clicks) || 0,
  }));

  return <MembersClient members={membersWithStats} invites={invites || []} />;
}
