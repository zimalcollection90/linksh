import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../../supabase/admin";
import { createClient } from "../../../../../../supabase/server";
import { getApiContext, requireActiveMembership, requireAdmin } from "../../../_lib/api-auth";

function toCsv(rows: Record<string, any>[], headers: string[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

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

  const [{ data: users, error: uErr }, { data: links, error: lErr }, { data: earnings, error: eErr }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, user_id, email, full_name, display_name, role, status, created_at, last_active_at, last_seen_ip")
        .order("created_at", { ascending: false }),
      supabase.from("links").select("user_id, click_count"),
      supabase.from("earnings").select("user_id, amount"),
    ]);

  if (uErr || lErr || eErr) {
    return NextResponse.json({ error: uErr?.message || lErr?.message || eErr?.message }, { status: 400 });
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

  const rows = (users || []).map((u: any) => ({
    id: u.id,
    email: u.email || "",
    display_name: u.display_name || u.full_name || "",
    role: u.role || "member",
    status: u.status || "pending",
    signup_date: u.created_at || "",
    last_activity: u.last_active_at || "",
    ip: u.last_seen_ip || "",
    link_count: linkStats[u.id]?.linkCount || 0,
    total_clicks: linkStats[u.id]?.totalClicks || 0,
    total_earnings: (earningStats[u.id] || 0).toFixed(2),
  }));

  const csv = toCsv(rows, [
    "id",
    "email",
    "display_name",
    "role",
    "status",
    "signup_date",
    "last_activity",
    "ip",
    "link_count",
    "total_clicks",
    "total_earnings",
  ]);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"members-global.csv\"",
    },
  });
}
