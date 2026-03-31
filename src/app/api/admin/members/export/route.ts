import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../../supabase/admin";
import { createClient } from "../../../../../../supabase/server";
import { getApiContext, requireAdmin } from "../../../_lib/api-auth";

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

  const userIds = (memberships || []).map((m: any) => m.user_id);
  if (userIds.length === 0) {
    return new NextResponse("id,email,display_name,role,status,link_count,total_clicks,total_earnings\n", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="members-${ctx.companyId}.csv"`,
      },
    });
  }

  const [{ data: users, error: uErr }, { data: links, error: lErr }, { data: earnings, error: eErr }] =
    await Promise.all([
      supabase.from("users").select("id, email, full_name, display_name").in("id", userIds),
      supabase.from("links").select("user_id, click_count").eq("company_id", ctx.companyId),
      supabase.from("earnings").select("user_id, amount").eq("company_id", ctx.companyId),
    ]);

  if (uErr || lErr || eErr) {
    return NextResponse.json({ error: uErr?.message || lErr?.message || eErr?.message }, { status: 400 });
  }

  const memberById: Record<string, any> = {};
  for (const m of memberships || []) memberById[(m as any).user_id] = m;

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
    role: memberById[u.id]?.role || "member",
    status: memberById[u.id]?.status || "pending",
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
    "link_count",
    "total_clicks",
    "total_earnings",
  ]);

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="members-${ctx.companyId}.csv"`,
    },
  });
}
