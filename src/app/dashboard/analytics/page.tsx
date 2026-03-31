import { createClient } from "../../../../supabase/server";
import AnalyticsClient from "./analytics-client";
import { redirect } from "next/navigation";

function rolePriority(role?: string) {
  if (role === "super_admin") return 3;
  if (role === "admin") return 2;
  return 1;
}

export default async function AnalyticsPage() {
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

  if (!effectiveMembership || effectiveMembership.status !== "active") {
    redirect("/dashboard");
  }

  const isAdmin =
    effectiveMembership.role === "admin" ||
    effectiveMembership.role === "super_admin" ||
    profile?.role === "admin";

  const linksQuery = isAdmin
    ? supabase
        .from("links")
        .select("id, title, short_code, click_count, status, created_at, user_id")
        .eq("company_id", effectiveMembership.company_id)
    : supabase
        .from("links")
        .select("id, title, short_code, click_count, status, created_at, user_id")
        .eq("company_id", effectiveMembership.company_id)
        .eq("user_id", user.id);

  const { data: links } = await linksQuery;

  const clicksQuery = isAdmin
    ? supabase
        .from("click_events")
        .select("id, link_id, country, country_code, device_type, browser, os, clicked_at")
        .eq("company_id", effectiveMembership.company_id)
        .order("clicked_at", { ascending: false })
        .limit(500)
    : supabase
        .from("click_events")
        .select("id, link_id, country, country_code, device_type, browser, os, clicked_at")
        .eq("company_id", effectiveMembership.company_id)
        .in("link_id", (links || []).map((l) => l.id))
        .order("clicked_at", { ascending: false })
        .limit(500);

  const { data: clicks } = await clicksQuery;

  let members: any[] = [];
  if (isAdmin) {
    const { data: memberships } = await supabase
      .from("company_members")
      .select("user_id, role, status")
      .eq("company_id", effectiveMembership.company_id);
    const ids = (memberships || []).map((m) => m.user_id);
    if (ids.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, display_name, email")
        .in("id", ids);
      const membershipById: Record<string, any> = {};
      for (const m of memberships || []) membershipById[m.user_id] = m;
      members = (users || []).map((u: any) => ({
        ...u,
        role: membershipById[u.id]?.role || "member",
        status: membershipById[u.id]?.status || "pending",
      }));
    }
  }

  return <AnalyticsClient links={links || []} clicks={clicks || []} isAdmin={isAdmin} members={members} />;
}
