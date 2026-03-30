import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../supabase/admin";
import { getApiContext, requireAdmin } from "../../_lib/api-auth";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext(req);
  requireAdmin(ctx);

  const supabase = createAdminClient();

  const { data: memberships, error: mErr } = await supabase
    .from("company_members")
    .select("user_id, role, status")
    .eq("company_id", ctx.companyId);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  const userIds = (memberships || []).map((m) => m.user_id);
  if (userIds.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, full_name, display_name, email, avatar_url, status, role")
    .in("id", userIds);

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  const memberById: Record<string, any> = {};
  for (const m of memberships || []) {
    memberById[m.user_id] = m;
  }

  const members = (users || []).map((u) => ({
    ...u,
    role: memberById[u.id]?.role ?? u.role,
  }));

  return NextResponse.json({ members });
}

