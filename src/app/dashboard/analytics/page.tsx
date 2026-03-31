import { createClient } from "../../../../supabase/server";
import AnalyticsClient from "./analytics-client";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  // Non-active non-admin → back to dashboard pending screen
  if (profile?.status !== "active" && !isAdmin) {
    redirect("/dashboard");
  }

  const userId = profile?.id ?? user.id;

  // Admin sees all links; member sees own
  const { data: links } = isAdmin
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

  // Admin sees all clicks; member sees own link clicks
  const clicksQuery = isAdmin
    ? supabase
        .from("click_events")
        .select("id, link_id, country, country_code, device_type, browser, os, clicked_at, is_bot, is_filtered, is_unique")
        .order("clicked_at", { ascending: false })
        .limit(500)
    : linkIds.length > 0
    ? supabase
        .from("click_events")
        .select("id, link_id, country, country_code, device_type, browser, os, clicked_at, is_bot, is_filtered, is_unique")
        .in("link_id", linkIds)
        .order("clicked_at", { ascending: false })
        .limit(500)
    : null;

  const { data: clicks } = clicksQuery ? await clicksQuery : { data: [] };

  // Admin: fetch all users as members list for filtering
  let members: any[] = [];
  if (isAdmin) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, display_name, email, role, status")
      .order("created_at", { ascending: false });
    members = (users || []).map((u: any) => ({
      ...u,
      role: u.role || "member",
      status: u.status || "pending",
    }));
  }

  return (
    <AnalyticsClient
      links={links || []}
      clicks={clicks || []}
      isAdmin={isAdmin}
      members={members}
    />
  );
}
