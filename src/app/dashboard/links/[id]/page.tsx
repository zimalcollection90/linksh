import { createClient } from "../../../../../supabase/server";
import LinkAnalyticsClient from "./link-analytics-client";
import { notFound } from "next/navigation";

export default async function LinkAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("links")
    .select("*")
    .eq("id", id)
    .single();

  if (!link) return notFound();

  const { data: clicks } = await supabase
    .from("click_events")
    .select("*")
    .eq("link_id", id)
    .order("clicked_at", { ascending: false });

  return <LinkAnalyticsClient link={link} clicks={clicks || []} />;
}
