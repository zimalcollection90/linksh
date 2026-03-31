import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../supabase/admin";
import { createClient } from "../../../../supabase/server";
import { getApiContext, requireAdmin } from "../_lib/api-auth";

function generateInviteToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getApiContext(req);
    requireAdmin(ctx);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "Unauthorized" }, { status: 401 });
  }
  let supabase: any;
  try {
    supabase = ctx.authMode === "api_key" ? createAdminClient() : await createClient();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to initialize database client" }, { status: 500 });
  }
  const { data, error } = await supabase
    .from("invites")
    .select("id, email, role, token, status, expires_at, created_at, company_id, invited_by")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invites: data || [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getApiContext(req);
    requireAdmin(ctx);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body?.email || "").toString().trim();
  const role = (body?.role || "member").toString().trim();

  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const inviteRole = role === "admin" ? "admin" : "member";
  const token = generateInviteToken();

  let supabase: any;
  try {
    supabase = ctx.authMode === "api_key" ? createAdminClient() : await createClient();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to initialize database client" }, { status: 500 });
  }
  const { data, error } = await supabase
    .from("invites")
    .insert({
      invited_by: ctx.userId,
      email,
      role: inviteRole,
      token,
    })
    .select("id, token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const origin = new URL(req.url).origin;
  const inviteUrl = `${origin}/invite?token=${encodeURIComponent(data.token)}`;

  return NextResponse.json({ invite: data, inviteUrl });
}

