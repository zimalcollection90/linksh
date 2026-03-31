import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../supabase/admin";
import { createClient } from "../../../../../supabase/server";
import { getApiContext, requireAdmin } from "../../_lib/api-auth";

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

  const { data: memberships, error: mErr } = await supabase
    .from("company_members")
    .select("user_id, role, status, created_at")
    .eq("company_id", ctx.companyId);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, full_name, display_name, email, avatar_url, status, role, created_at")
    .order("created_at", { ascending: false });

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  const { data: links, error: lErr } = await supabase
    .from("links")
    .select("user_id, click_count")
    .eq("company_id", ctx.companyId);
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 400 });

  const { data: earnings, error: eErr } = await supabase
    .from("earnings")
    .select("user_id, amount")
    .eq("company_id", ctx.companyId);
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 400 });

  const memberById: Record<string, any> = {};
  for (const m of memberships || []) {
    memberById[m.user_id] = m;
  }

  const linkStats: Record<string, { linkCount: number; totalClicks: number }> = {};
  for (const l of links || []) {
    if (!l.user_id) continue;
    linkStats[l.user_id] = linkStats[l.user_id] || { linkCount: 0, totalClicks: 0 };
    linkStats[l.user_id].linkCount += 1;
    linkStats[l.user_id].totalClicks += l.click_count || 0;
  }

  const earningStats: Record<string, number> = {};
  for (const e of earnings || []) {
    if (!e.user_id) continue;
    earningStats[e.user_id] = (earningStats[e.user_id] || 0) + (e.amount || 0);
  }

  const members = (users || []).map((u: any) => ({
    ...u,
    role: memberById[u.id]?.role ?? (u.role === "admin" ? "admin" : "member"),
    membership_status: memberById[u.id]?.status ?? "pending",
    membership_created_at: memberById[u.id]?.created_at ?? u.created_at,
    linkCount: linkStats[u.id]?.linkCount || 0,
    totalClicks: linkStats[u.id]?.totalClicks || 0,
    totalEarnings: earningStats[u.id] || 0,
    isInCompany: !!memberById[u.id],
  }));

  return NextResponse.json({ members });
}

export async function PATCH(req: NextRequest) {
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = (body?.action || "").toString();
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.map((v: any) => v?.toString()).filter(Boolean)
    : [];
  const userId = (body?.userId || "").toString();
  const targetIds = userIds.length > 0 ? userIds : userId ? [userId] : [];

  if (targetIds.length === 0) {
    return NextResponse.json({ error: "userId or userIds is required" }, { status: 400 });
  }

  if (action === "set_status") {
    const status = (body?.status || "").toString();
    for (const id of targetIds) {
      await supabase
        .from("company_members")
        .upsert(
          {
            company_id: ctx.companyId,
            user_id: id,
            role: "member",
            status: "pending",
          },
          { onConflict: "company_id,user_id" }
        );
      const { error } = await supabase.rpc("admin_set_member_status", {
        p_company_id: ctx.companyId,
        p_member_user_id: id,
        p_status: status,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "set_role") {
    const role = (body?.role || "").toString();
    if (targetIds.length > 1) {
      return NextResponse.json({ error: "Bulk role updates are not supported" }, { status: 400 });
    }
    await supabase
      .from("company_members")
      .upsert(
        {
          company_id: ctx.companyId,
          user_id: targetIds[0],
          role: "member",
          status: "pending",
        },
        { onConflict: "company_id,user_id" }
      );
    const { error } = await supabase.rpc("admin_set_member_role", {
      p_company_id: ctx.companyId,
      p_member_user_id: targetIds[0],
      p_role: role,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

