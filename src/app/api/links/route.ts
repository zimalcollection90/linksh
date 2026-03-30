import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../supabase/admin";
import { getApiContext } from "../_lib/api-auth";
import { createClient } from "../../../../supabase/server";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext(req);

  // Prefer RLS/session mode client when possible.
  const supabase = ctx.authMode === "api_key" ? createAdminClient() : await createClient();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const query = supabase
    .from("links")
    .select(
      "id, short_code, destination_url, title, click_count, status, expires_at, is_password_protected, utm_source, utm_medium, utm_campaign, utm_term, utm_content"
    )
    .order("created_at", { ascending: false });

  query.eq("company_id", ctx.companyId);

  if (ctx.role === "member") {
    query.eq("user_id", ctx.userId);
  }

  if (status) {
    query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ links: data || [] });
}

// POST create is intentionally not implemented yet in this phased rollout.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

