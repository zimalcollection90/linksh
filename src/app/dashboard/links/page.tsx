import { createClient } from "../../../../supabase/server";
import LinksClient from "./links-client";
import { redirect } from "next/navigation";

function rolePriority(role?: string) {
  if (role === "super_admin") return 3;
  if (role === "admin") return 2;
  return 1;
}

export default async function LinksPage() {
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

  const query = isAdmin
    ? supabase
        .from("links")
        .select("*, users(full_name, display_name, email)")
        .eq("company_id", effectiveMembership.company_id)
        .order("created_at", { ascending: false })
    : supabase
        .from("links")
        .select("*")
        .eq("company_id", effectiveMembership.company_id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

  const { data: links } = await query;

  return <LinksClient links={links || []} isAdmin={isAdmin} />;
}
