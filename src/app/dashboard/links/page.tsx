import { createClient } from "../../../../supabase/server";
import LinksClient from "./links-client";
import { redirect } from "next/navigation";

export default async function LinksPage(props: { searchParams: Promise<{ view?: string }> }) {
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

  // Non-active, non-admin users redirect to dashboard (which shows pending/suspended message)
  if (profile?.status !== "active" && !isAdmin) {
    return redirect("/dashboard");
  }

  let query = supabase.from("links").select("*, users(full_name, display_name, email)");

  if (isAdmin) {
    if (isOwnView) {
      query = query.eq("user_id", user.id);
    }
    // else: show all links for admins by default or if view=all
  } else {
    query = query.eq("user_id", user.id);
  }

  const { data: links } = await query.order("created_at", { ascending: false });

  return (
    <LinksClient 
      links={links || []} 
      isAdmin={isAdmin} 
      view={isAdmin ? (isOwnView ? "own" : "all") : "own"} 
    />
  );
}
