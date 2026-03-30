import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../../supabase/admin";
import { getApiContext, requireAdmin } from "../../../_lib/api-auth";

function toCsv(rows: any[], headers: string[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const headerLine = headers.map(esc).join(",");
  const lines = rows.map((r) => headers.map((h) => esc(r?.[h])).join(","));
  return [headerLine, ...lines].join("\n");
}

export async function GET(req: NextRequest) {
  const ctx = await getApiContext(req);
  requireAdmin(ctx);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("earnings")
    .select(
      "id, link_id, clicks, rate, amount, period_start, period_end, payment_status, paid_at, created_at"
    )
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const headers = [
    "id",
    "link_id",
    "clicks",
    "rate",
    "amount",
    "period_start",
    "period_end",
    "payment_status",
    "paid_at",
    "created_at",
  ];

  const csv = toCsv(data || [], headers);
  const filename = `earnings-${ctx.companyId}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

