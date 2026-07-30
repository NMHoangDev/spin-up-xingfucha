import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildSpinReportWorkbook, type ExportSpinRow } from "@/lib/reports/build-workbook";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_ROWS = 100_000;

function statusFromRow(row: any): "used" | "unused" {
  return row.status === "used" ? "used" : "unused";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? new Date(0).toISOString();
  const to = searchParams.get("to") ?? new Date().toISOString();
  const storesParam = searchParams.get("stores");
  const storeCodes = storesParam ? storesParam.split(",").filter(Boolean) : null;

  const supabase = createSupabaseServiceClient();

  const { data: analytics, error: analyticsError } = await supabase.rpc(
    "fn_admin_analytics",
    { p_from: from, p_to: to, p_store_codes: storeCodes },
  );
  if (analyticsError) {
    return NextResponse.json({ error: analyticsError.message }, { status: 500 });
  }

  const rows: ExportSpinRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    let query = supabase
      .from("spins")
      .select(
        "customer_name, customer_phone, store_code, status, voucher_usable_from, voucher_expires_at, used_at, invoice_amount, created_at, prizes(label, code), stores(name)",
      )
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (storeCodes && storeCodes.length > 0) {
      query = query.in("store_code", storeCodes);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const row of data ?? []) {
      rows.push({
        name: row.customer_name,
        phone: row.customer_phone,
        storeCode: row.store_code,
        storeName: (row.stores as any)?.name ?? row.store_code,
        rewardLabel: (row.prizes as any)?.label ?? "",
        rewardCode: (row.prizes as any)?.code ?? null,
        status: statusFromRow(row),
        voucherUsableFrom: row.voucher_usable_from,
        voucherExpiresAt: row.voucher_expires_at,
        usedAt: row.used_at,
        invoiceAmount: row.invoice_amount === null ? null : Number(row.invoice_amount),
        createdAt: row.created_at,
      });
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  const rangeLabel = `${new Date(from).toLocaleDateString("vi-VN")} - ${new Date(to).toLocaleDateString("vi-VN")}`;
  const storeLabel =
    storeCodes && storeCodes.length > 0 ? storeCodes.join(", ") : "Tất cả";

  const buffer = await buildSpinReportWorkbook({
    analytics,
    rows,
    rangeLabel,
    storeLabel,
  });

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="bao-cao-vong-quay.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
