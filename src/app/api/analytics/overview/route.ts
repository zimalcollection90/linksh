import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../supabase/admin";
import { createClient } from "../../../../../supabase/server";
import { getApiContext, requireActiveMembership } from "../../_lib/api-auth";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext(req);
  requireActiveMembership(ctx);
  const supabase = ctx.authMode === "api_key" ? createAdminClient() : await createClient();

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // optional

  const linksQuery = supabase.from("links").select("id, click_count, company_id, user_id").eq("company_id", ctx.companyId);
  if (ctx.role === "member") linksQuery.eq("user_id", ctx.userId);

  const earningsQuery = supabase
    .from("earnings")
    .select("amount")
    .eq("company_id", ctx.companyId);
  if (ctx.role === "member") earningsQuery.eq("user_id", ctx.userId);

  const membersQuery = supabase
    .from("company_members")
    .select("id")
    .eq("company_id", ctx.companyId)
    .eq("status", "active");

  const [linksRes, earningsRes, membersRes] = await Promise.all([
    linksQuery,
    earningsQuery,
    membersQuery,
  ]);

  if (linksRes.error) return NextResponse.json({ error: linksRes.error.message }, { status: 400 });
  if (earningsRes.error) return NextResponse.json({ error: earningsRes.error.message }, { status: 400 });
  if (membersRes.error) return NextResponse.json({ error: membersRes.error.message }, { status: 400 });

  const totalLinks = (linksRes.data || []).length;
  const totalClicks = (linksRes.data || []).reduce((s: number, l: any) => s + (l.click_count || 0), 0);
  const totalEarnings = (earningsRes.data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const activeMembers = (membersRes.data || []).length;

  return NextResponse.json({
    stats: {
      totalLinks,
      totalClicks,
      totalEarnings,
      activeMembers,
    },
  });
}

