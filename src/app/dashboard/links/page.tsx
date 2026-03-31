import { createClient } from "../../../../supabase/server";
import LinksClient from "./links-client";
import { redirect } from "next/navigation";

export default async function LinksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  // Non-active, non-admin users redirect to dashboard (which shows pending/suspended message)
  if (profile?.status !== "active" && !isAdmin) {
    return redirect("/dashboard");
  }

  const query = isAdmin
    ? supabase
        .from("links")
        .select("*, users(full_name, display_name, email)")
        .eq("user_id", profile?.id ?? user.id)
        .order("created_at", { ascending: false })
    : supabase
        .from("links")
        .select("*")
        .eq("user_id", profile?.id ?? user.id)
        .order("created_at", { ascending: false });

  const { data: links } = await query;

  return <LinksClient links={links || []} isAdmin={isAdmin} />;
}
