import { createClient } from "../../../../supabase/server";
import { redirect } from "next/navigation";
import MembersClient from "./members-client";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return redirect("/dashboard");
  }

  const { data: members } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: invites } = await supabase
    .from("invites")
    .select("*")
    .order("created_at", { ascending: false });

  const membersWithStats = await Promise.all(
    (members || []).map(async (m: any) => {
      const { data: links } = await supabase
        .from("links")
        .select("click_count")
        .eq("user_id", m.id);
      const clicks = (links || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
      const { data: earnings } = await supabase
        .from("earnings")
        .select("amount")
        .eq("user_id", m.id);
      const totalEarnings = (earnings || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
      return { ...m, totalClicks: clicks, linkCount: links?.length || 0, totalEarnings };
    })
  );

  return <MembersClient members={membersWithStats} invites={invites || []} />;
}
