import { createClient } from "../../../../supabase/server";
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
  if (!isAdmin || profile?.status !== "active") {
    return redirect("/dashboard");
  }

  // Fetch all members globally — no company filtering
  const { data: members } = await supabase
    .from("users")
    .select("id, full_name, display_name, email, avatar_url, status, role, created_at, last_active_at, last_seen_ip")
    .order("created_at", { ascending: false });

  // Link stats per user
  const { data: links } = await supabase
    .from("links")
    .select("user_id, click_count");

  // Click stats per user
  const { data: memberClickStats } = await supabase
    .from("click_events")
    .select("user_id, is_bot, is_filtered, is_unique")
    .limit(50000);

  const clickStatsByUser: Record<string, any> = {};
  for (const s of memberClickStats || []) {
    if (!s.user_id) continue;
    const bucket = clickStatsByUser[s.user_id] || {
      real_clicks: 0, unique_users: 0, bot_excluded: 0, filtered_clicks: 0,
    };
    if (s.is_bot) bucket.bot_excluded += 1;
    if (s.is_filtered) bucket.filtered_clicks += 1;
    if (!s.is_bot && !s.is_filtered) bucket.real_clicks += 1;
    if (s.is_unique) bucket.unique_users += 1;
    clickStatsByUser[s.user_id] = bucket;
  }

  const linkStats: Record<string, { linkCount: number; totalClicks: number }> = {};
  for (const l of links || []) {
    if (!l.user_id) continue;
    linkStats[l.user_id] = linkStats[l.user_id] || { linkCount: 0, totalClicks: 0 };
    linkStats[l.user_id].linkCount += 1;
    linkStats[l.user_id].totalClicks += l.click_count || 0;
  }

  const membersWithStats = (members || []).map((m: any) => ({
    ...m,
    role: m.role || "member",
    status: m.status || "pending",
    totalClicks: linkStats[m.id]?.totalClicks || 0,
    linkCount: linkStats[m.id]?.linkCount || 0,
    realClicks: Number(clickStatsByUser[m.id]?.real_clicks) || 0,
    uniqueUsers: Number(clickStatsByUser[m.id]?.unique_users) || 0,
    botExcluded: Number(clickStatsByUser[m.id]?.bot_excluded) || 0,
    filteredClicks: Number(clickStatsByUser[m.id]?.filtered_clicks) || 0,
  }));

  return <MembersClient members={membersWithStats} />;
}
