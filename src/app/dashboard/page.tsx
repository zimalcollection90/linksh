import { createClient } from "../../../supabase/server";
import AdminDashboard from "./components/admin-dashboard";
import MemberDashboard from "./components/member-dashboard";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const userId = profile?.id;

  let totalLinks = 0, totalClicks = 0, activeMembers = 0;

  if (isAdmin) {
    const [linksRes, clicksRes, membersRes] = await Promise.all([
      supabase.from("links").select("id", { count: "exact", head: true }),
      supabase.from("links").select("click_count"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);
    totalLinks = linksRes.count || 0;
    totalClicks = (clicksRes.data || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
    activeMembers = membersRes.count || 0;
  } else {
    const [linksRes, myLinksRes] = await Promise.all([
      supabase.from("links").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("links").select("click_count").eq("user_id", userId),
    ]);
    totalLinks = linksRes.count || 0;
    totalClicks = (myLinksRes.data || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
  }

  const recentLinksQuery = isAdmin
    ? supabase.from("links").select("*, users(full_name, display_name, email)").order("created_at", { ascending: false }).limit(5)
    : supabase.from("links").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);

  const { data: recentLinks } = await recentLinksQuery;

  const { data: recentClicks } = await supabase
    .from("click_events")
    .select("*, links(title, short_code)")
    .order("clicked_at", { ascending: false })
    .limit(10);

  let topMembers: any[] = [];
  if (isAdmin) {
    const { data: members } = await supabase
      .from("users")
      .select("id, full_name, display_name, email, avatar_url, status")
      .order("created_at", { ascending: false })
      .limit(8);
    if (members) {
      const membersWithStats = await Promise.all(
        members.map(async (m: any) => {
          const { data: links } = await supabase
            .from("links")
            .select("click_count")
            .eq("user_id", m.id);
          const clicks = (links || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
          return { ...m, totalClicks: clicks, linkCount: links?.length || 0 };
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

  const stats = { totalLinks, totalClicks, activeMembers, totalEarnings };

  if (isAdmin) {
    return (
      <AdminDashboard
        stats={stats}
        recentLinks={recentLinks || []}
        recentClicks={recentClicks || []}
        topMembers={topMembers}
        profile={profile}
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
