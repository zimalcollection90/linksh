import { createClient } from "../../../../supabase/server";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  const linksQuery = isAdmin
    ? supabase.from("links").select("id, title, short_code, click_count, status, created_at")
    : supabase.from("links").select("id, title, short_code, click_count, status, created_at").eq("user_id", profile?.id);

  const { data: links } = await linksQuery;

  const clicksQuery = isAdmin
    ? supabase.from("click_events").select("id, country, country_code, device_type, browser, os, clicked_at").order("clicked_at", { ascending: false }).limit(500)
    : supabase.from("click_events").select("id, country, country_code, device_type, browser, os, clicked_at").in("link_id", (links || []).map(l => l.id)).order("clicked_at", { ascending: false }).limit(500);

  const { data: clicks } = await clicksQuery;

  return <AnalyticsClient links={links || []} clicks={clicks || []} isAdmin={isAdmin} />;
}
