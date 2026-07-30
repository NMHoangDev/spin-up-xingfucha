import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Prize } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function toCamel(row: any): Prize {
  return {
    id: row.id,
    label: row.label,
    code: row.code,
    weight: Number(row.weight),
    dailyLimit: row.daily_limit,
    totalLimit: row.total_limit,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: Partial<Prize>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("label" in body) update.label = body.label?.trim();
  if ("code" in body) update.code = body.code?.trim() || null;
  if ("weight" in body) update.weight = body.weight;
  if ("dailyLimit" in body) update.daily_limit = body.dailyLimit;
  if ("totalLimit" in body) update.total_limit = body.totalLimit;
  if ("isActive" in body) update.is_active = body.isActive;
  if ("sortOrder" in body) update.sort_order = body.sortOrder;
  update.updated_at = new Date().toISOString();

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("prizes")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(toCamel(data));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { count } = await supabase
    .from("spins")
    .select("id", { count: "exact", head: true })
    .eq("prize_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      {
        error: "has_spin_history",
        message:
          "Quà này đã có lượt quay gắn với nó — hãy tắt (ẩn) thay vì xoá để giữ lịch sử báo cáo.",
      },
      { status: 409 },
    );
  }

  const { count: pendingAssignments } = await supabase
    .from("assigned_gifts")
    .select("id", { count: "exact", head: true })
    .eq("prize_id", id)
    .eq("status", "pending");

  if (pendingAssignments && pendingAssignments > 0) {
    return NextResponse.json(
      {
        error: "has_pending_assignment",
        message:
          "Quà này đang được chỉ định trước cho một số điện thoại — hãy huỷ chỉ định đó trước khi xoá quà.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("prizes").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
