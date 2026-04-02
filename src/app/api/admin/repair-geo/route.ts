import { NextResponse } from "next/server";
import { createClient } from "../../../../../supabase/server";
import { inngest } from "../../../../inngest/client";

/**
 * POST /api/admin/repair-geo
 *
 * Triggers an Inngest background job to repair click_events rows
 * that are missing geo data. Works on hundreds of rows without
 * hitting HTTP timeouts, with automatic retry on GeoIP failures.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fire the Inngest repair job in the background — returns instantly
  await inngest.send({
    name: "analytics/repair.requested",
    data: { triggeredBy: user.id, triggeredAt: new Date().toISOString() },
  });

  return NextResponse.json({
    message:
      "Geo repair job queued. It will process up to 300 rows in the background with automatic retries. Check the Inngest dashboard for progress.",
    jobQueued: true,
  });
}
