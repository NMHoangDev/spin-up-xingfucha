import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { toRedeemErrorCode, type RedeemErrorCode } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<RedeemErrorCode, string> = {
  not_found: "Không tìm thấy voucher để sử dụng.",
  already_used: "Voucher này đã được sử dụng trước đó.",
  not_usable_yet: "Voucher này chưa tới hạn sử dụng.",
  expired: "Voucher này đã hết hạn sử dụng.",
  daily_usage_limit_reached: "Bạn đã dùng hết số voucher tối đa hôm nay.",
};

export async function POST(request: Request) {
  let body: { spinId?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const spinId = (body.spinId ?? "").trim();
  const phone = (body.phone ?? "").trim();

  if (!spinId || !phone) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("fn_redeem_voucher", {
    p_spin_id: spinId,
    p_phone: phone,
  });

  if (error) {
    const code = toRedeemErrorCode(error.message);
    return NextResponse.json(
      { error: code, message: ERROR_MESSAGES[code] },
      { status: 400 },
    );
  }

  return NextResponse.json(data);
}
