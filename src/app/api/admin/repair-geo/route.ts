import { NextResponse } from "next/server";
import { createClient } from "../../../../../supabase/server";
import { createAdminClient } from "../../../../../supabase/admin";

// Redefining a minimal version of resolveGeoIP for internal use or importing if possible
// For simplicity in this script, we'll use a direct fetch to the most reliable one
async function repairIp(ip: string): Promise<{ country: string | null; countryCode: string | null }> {
  try {
    // We'll use ipwho.is as the primary repair tool as it's fast and has good coverage
    const resp = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { cache: "no-store" });
    const data = await resp.json();
    if (data && data.success) {
      return { 
        country: data.country || null, 
        countryCode: (data.country_code || "").toUpperCase() || null 
      };
    }
  } catch (e) {
    console.error("Repair failed for IP:", ip, e);
  }
  return { country: null, countryCode: null };
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const adminClient = createAdminClient();
  
  // Find records that need repair
  const { data: pending, error: fetchError } = await adminClient
    .from("click_events")
    .select("id, ip_address")
    .or("country.is.null,country.eq.Unknown")
    .limit(50); // Small batches to avoid timeouts

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!pending || pending.length === 0) return NextResponse.json({ message: "No records need repair.", count: 0 });

  let repairedCount = 0;
  for (const record of pending) {
    if (!record.ip_address) continue;
    
    const geo = await repairIp(record.ip_address);
    if (geo.country) {
      await adminClient
        .from("click_events")
        .update({ 
          country: geo.country, 
          country_code: geo.countryCode,
          filter_reason: "repaired" // Mark that it was repaired
        })
        .eq("id", record.id);
      repairedCount++;
    }
  }

  return NextResponse.json({ 
    message: `Repair completed successfully.`, 
    repaired: repairedCount,
    totalChecked: pending.length 
  });
}
