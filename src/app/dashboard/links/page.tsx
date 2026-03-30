import { createClient } from "../../../../supabase/server";
import LinksClient from "./links-client";

export default async function LinksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  const query = isAdmin
    ? supabase.from("links").select("*, users(full_name, display_name, email)").order("created_at", { ascending: false })
    : supabase.from("links").select("*").eq("user_id", profile?.id).order("created_at", { ascending: false });

  const { data: links } = await query;

  return <LinksClient links={links || []} isAdmin={isAdmin} />;
}
