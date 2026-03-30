import { createClient } from "../../../../supabase/server";
import { notFound } from "next/navigation";
import BioPageClient from "./bio-page-client";

export default async function BioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) return notFound();

  const { data: links } = await supabase
    .from("links")
    .select("id, short_code, title, destination_url, click_count")
    .eq("user_id", profile.id)
    .eq("status", "active")
    .order("click_count", { ascending: false })
    .limit(20);

  return <BioPageClient profile={profile} links={links || []} />;
}
