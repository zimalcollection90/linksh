import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../supabase/admin";
import { createClient } from "../../../../../supabase/server";
import { getApiContext, requireActiveMembership, requireAdmin } from "../../_lib/api-auth";

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await getApiContext(req);
    requireAdmin(ctx);
    requireActiveMembership(ctx);
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

  const usersQuery = (columns: string) =>
    supabase
      .from("users")
      .select(columns)
      .order("created_at", { ascending: false });

  let { data: users, error: uErr } = await usersQuery(
    "id, user_id, full_name, display_name, email, avatar_url, status, role, created_at, earnings_rate, last_active_at, last_seen_ip"
  );
  if (uErr) {
    // Fallback for environments where optional profile columns are not migrated yet.
    const fallback = await usersQuery(
      "id, user_id, full_name, display_name, email, avatar_url, status, role, created_at"
    );
    users = fallback.data;
    uErr = fallback.error;
  }

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  const { data: links, error: lErr } = await supabase
    .from("links")
    .select("user_id, click_count")
    .in("user_id", (users || []).map((u: any) => u.id));
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 400 });

  const { data: earnings, error: eErr } = await supabase
    .from("earnings")
    .select("user_id, amount")
    .in("user_id", (users || []).map((u: any) => u.id));
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 400 });

  const { data: memberClickStats } = await supabase
    .from("click_events")
    .select("user_id, is_bot, is_filtered, is_unique")
    .in("user_id", (users || []).map((u: any) => u.id))
    .limit(50000);

  const clickStatsByUser: Record<string, any> = {};
  for (const s of memberClickStats || []) {
    if (!s.user_id) continue;
    const bucket = clickStatsByUser[s.user_id] || {
      real_clicks: 0,
      unique_users: 0,
      bot_excluded: 0,
      filtered_clicks: 0,
    };
    if (s.is_bot) bucket.bot_excluded += 1;
    if (s.is_filtered) bucket.filtered_clicks += 1;
    if (!s.is_bot && !s.is_filtered) bucket.real_clicks += 1;
    if (s.is_unique) bucket.unique_users += 1;
    clickStatsByUser[s.user_id] = bucket;
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
    role: u.role === "admin" || u.role === "super_admin" ? u.role : "member",
    membership_status: u.status ?? "pending",
    membership_created_at: u.created_at,
    linkCount: linkStats[u.id]?.linkCount || 0,
    totalClicks: linkStats[u.id]?.totalClicks || 0,
    totalEarnings: earningStats[u.id] || 0,
    isInCompany: true,
    realClicks: Number(clickStatsByUser[u.id]?.real_clicks) || 0,
    uniqueUsers: Number(clickStatsByUser[u.id]?.unique_users) || 0,
    botExcluded: Number(clickStatsByUser[u.id]?.bot_excluded) || 0,
    filteredClicks: Number(clickStatsByUser[u.id]?.filtered_clicks) || 0,
  }));

  return NextResponse.json({ members });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try {
    ctx = await getApiContext(req);
    requireAdmin(ctx);
    requireActiveMembership(ctx);
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
    const requested = (body?.status || "").toString().toLowerCase();
    const status =
      requested === "approve" ? "active" :
      requested === "reject" ? "suspended" :
      requested;
    if (!["active", "pending", "suspended"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    for (const id of targetIds) {
      const { error } = await supabase
        .from("users")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "set_role") {
    const role = (body?.role || "").toString();
    if (targetIds.length > 1) {
      return NextResponse.json({ error: "Bulk role updates are not supported" }, { status: 400 });
    }
    if (!["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const { error } = await supabase
      .from("users")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", targetIds[0]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

