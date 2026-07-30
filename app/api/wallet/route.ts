import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SpinRow = {
  id: string;
  prize_id: string;
  voucher_usable_from: string | null;
  voucher_expires_at: string | null;
  created_at: string;
  prizes: { label: string; code: string | null } | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = (searchParams.get("phone") ?? "").trim();

  if (!phone) {
    return NextResponse.json({ items: [] });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("spins")
    .select(
      "id, prize_id, voucher_usable_from, voucher_expires_at, created_at, prizes(label, code)",
    )
    .eq("customer_phone", phone)
    .eq("status", "unused")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as SpinRow[];
  const groups = new Map<
    string,
    {
      prizeId: string;
      label: string;
      code: string | null;
      quantity: number;
      redeemableSpinId: string;
      nextUsableFrom: string | null;
      nextExpiresAt: string | null;
    }
  >();

  for (const row of rows) {
    const existing = groups.get(row.prize_id);
    if (existing) {
      existing.quantity += 1;
    } else {
      groups.set(row.prize_id, {
        prizeId: row.prize_id,
        label: row.prizes?.label ?? "Phần thưởng",
        code: row.prizes?.code ?? null,
        quantity: 1,
        // Rows come back oldest-first, so the first row seen per prize is
        // the one `fn_redeem_voucher` should consume next (FIFO).
        redeemableSpinId: row.id,
        nextUsableFrom: row.voucher_usable_from,
        nextExpiresAt: row.voucher_expires_at,
      });
    }
  }

  return NextResponse.json({ items: Array.from(groups.values()) });
}
