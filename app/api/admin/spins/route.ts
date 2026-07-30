import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const search = (searchParams.get("search") ?? "").trim().replace(/[,()%]/g, "");
  const storesParam = searchParams.get("stores");
  const storeCodes = storesParam ? storesParam.split(",").filter(Boolean) : null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("spins")
    .select(
      "id, store_code, customer_name, customer_phone, prize_id, status, voucher_usable_from, voucher_expires_at, used_at, invoice_amount, created_at, prizes(label, code)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`,
    );
  }
  if (storeCodes && storeCodes.length > 0) {
    query = query.in("store_code", storeCodes);
  }
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const start = (page - 1) * limit;
  query = query.range(start, start + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((row: any) => ({
      id: row.id,
      storeCode: row.store_code,
      name: row.customer_name,
      phone: row.customer_phone,
      rewardLabel: row.prizes?.label ?? "",
      rewardCode: row.prizes?.code ?? null,
      status: row.status,
      voucherUsableFrom: row.voucher_usable_from,
      voucherExpiresAt: row.voucher_expires_at,
      usedAt: row.used_at,
      invoiceAmount: row.invoice_amount === null ? null : Number(row.invoice_amount),
      createdAt: row.created_at,
    })),
    total: count ?? 0,
  });
}
