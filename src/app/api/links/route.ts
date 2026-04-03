import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../supabase/admin";
import { getApiContext, requireActiveUserResponse, requireAdmin } from "../_lib/api-auth";
import { createClient } from "../../../../supabase/server";

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getApiContext(req);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "Unauthorized" }, { status: 401 });
  }

  const denied = requireActiveUserResponse(ctx);
  if (denied) return denied;

  const supabase = ctx.authMode === "api_key" ? createAdminClient() : await createClient();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const view = searchParams.get("view");

  const query = supabase
    .from("links")
    .select(
      "id, short_code, destination_url, title, click_count, status, expires_at, is_password_protected, utm_source, utm_medium, utm_campaign, utm_term, utm_content"
    )
    .order("created_at", { ascending: false });

  if (ctx.role === "member" || (ctx.role === "admin" && view === "own")) {
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

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getApiContext(req);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "Unauthorized" }, { status: 401 });
  }

  const denied = requireActiveUserResponse(ctx);
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const destinationUrl = (body?.destination_url || "").toString().trim();
  const shortCode = (body?.short_code || "").toString().trim();
  if (!destinationUrl || !shortCode) {
    return NextResponse.json(
      { error: "destination_url and short_code are required" },
      { status: 400 }
    );
  }

  // No company_id — just user_id
  const payload = {
    user_id: ctx.userId,
    destination_url: destinationUrl,
    short_code: shortCode,
    title: body?.title || null,
    status: body?.status || "active",
    expires_at: body?.expires_at || null,
    is_password_protected: !!body?.is_password_protected,
    password_hash: body?.password_hash || null,
    utm_source: body?.utm_source || null,
    utm_medium: body?.utm_medium || null,
    utm_campaign: body?.utm_campaign || null,
    utm_term: body?.utm_term || null,
    utm_content: body?.utm_content || null,
  };

  const supabase = ctx.authMode === "api_key" ? createAdminClient() : await createClient();
  const { data, error } = await supabase
    .from("links")
    .insert(payload)
    .select("id, short_code, destination_url, title, click_count, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ link: data }, { status: 201 });
}
