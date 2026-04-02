import { createAdminClient } from "./supabase/admin";

async function inspect() {
  const adminClient = createAdminClient();
  const { data: clicks, error } = await adminClient
    .from("click_events")
    .select("*")
    .limit(10);
    
  if (error) {
    console.error("Error fetching clicks:", error);
    return;
  }
  
  console.log("SAMPLE CLICKS DATA:");
  console.table(clicks.map(c => ({
    id: c.id,
    ip: c.ip_address,
    country: c.country,
    country_code: c.country_code,
    is_bot: c.is_bot,
    is_filtered: c.is_filtered,
    is_unique: c.is_unique
  })));
}

inspect();
