import { createAdminClient } from "../supabase/admin";

async function inspectUnknowns() {
  const adminClient = createAdminClient();
  const { data: unknowns, error } = await adminClient
    .from("click_events")
    .select("id, ip_address, country, country_code, user_agent")
    .or("country.is.null,country.eq.Unknown,country_code.eq.XX")
    .limit(50);
    
  if (error) {
    console.error("Error fetching unknowns:", error);
    return;
  }
  
  console.log(`FOUND ${unknowns.length} UNKNOWN/PENDING CLICKS:`);
  console.table(unknowns.map(c => ({
    id: c.id,
    ip: c.ip_address,
    country: c.country,
    code: c.country_code,
    ua: c.user_agent?.substring(0, 50) + "..."
  })));
}

inspectUnknowns();
