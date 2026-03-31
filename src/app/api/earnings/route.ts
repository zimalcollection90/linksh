import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../supabase/admin";
import { getApiContext } from "../_lib/api-auth";

export async function GET(req: NextRequest) {
  const ctx = await getApiContext(req);
  const supabase = createAdminClient();

  const query = supabase
    .from("earnings")
    .select("id, link_id, clicks, rate, amount, period_start, period_end, payment_status, paid_at, created_at")
    .order("created_at", { ascending: false });

  // Admin sees all earnings; member sees own
  if (ctx.role === "member") {
    query.eq("user_id", ctx.userId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ earnings: data || [] });
}

