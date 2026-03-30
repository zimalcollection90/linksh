import { createClient } from "../../../../supabase/server";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, usage_count, is_active, created_at")
    .eq("user_id", profile?.id || "")
    .order("created_at", { ascending: false });

  const { data: ipExclusions } = await supabase
    .from("ip_exclusions")
    .select("*")
    .eq("user_id", profile?.id || "")
    .order("created_at", { ascending: false });

  return (
    <SettingsClient
      profile={profile}
      apiKeys={apiKeys || []}
      ipExclusions={ipExclusions || []}
    />
  );
}
