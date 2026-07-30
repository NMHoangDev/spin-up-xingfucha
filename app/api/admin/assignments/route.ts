import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { AssignedGift } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const ASSIGN_ERROR_MESSAGES: Record<string, string> = {
  invalid_phone: "Vui lòng nhập số điện thoại hợp lệ.",
  unknown_prize: "Không tìm thấy phần quà đã chọn.",
};

function toCamel(row: any): AssignedGift {
  return {
    id: row.id,
    phone: row.phone,
    prizeId: row.prize_id,
    prizeLabel: row.prizes?.label ?? null,
    prizeCode: row.prizes?.code ?? null,
    status: row.status,
    note: row.note,
    existingCustomerName: row.existing_customer_name,
    spinId: row.spin_id,
    fulfilledStoreCode: row.spins?.store_code ?? null,
    fulfilledCustomerName: row.spins?.customer_name ?? null,
    createdAt: row.created_at,
    fulfilledAt: row.fulfilled_at,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = (searchParams.get("search") ?? "").trim().replace(/[,()%]/g, "");

  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("assigned_gifts")
    .select("*, prizes(label, code), spins(customer_name, store_code)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("phone", `%${search}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: (data ?? []).map(toCamel) });
}

export async function POST(request: Request) {
  let body: { phone?: string; prizeId?: string; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const prizeId = (body.prizeId ?? "").trim();
  const note = body.note?.trim() || null;

  if (!phone) {
    return NextResponse.json(
      { error: "invalid_phone", message: ASSIGN_ERROR_MESSAGES.invalid_phone },
      { status: 400 },
    );
  }
  if (!prizeId) {
    return NextResponse.json({ error: "prize_required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("fn_assign_gift", {
    p_phone: phone,
    p_prize_id: prizeId,
    p_note: note,
  });

  if (error) {
    const code = error.message in ASSIGN_ERROR_MESSAGES ? error.message : "assign_failed";
    return NextResponse.json(
      { error: code, message: ASSIGN_ERROR_MESSAGES[code] ?? "Chỉ định quà thất bại." },
      { status: 400 },
    );
  }

  const { data: row, error: fetchError } = await supabase
    .from("assigned_gifts")
    .select("*, prizes(label, code), spins(customer_name, store_code)")
    .eq("id", data.id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({
    ...toCamel(row),
    isExistingCustomer: Boolean(data.isExistingCustomer),
  });
}
