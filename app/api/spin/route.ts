import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { toSpinErrorCode, type SpinErrorCode } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<SpinErrorCode, string> = {
  invalid_name: "Vui lòng nhập đầy đủ họ tên.",
  invalid_phone: "Vui lòng nhập số điện thoại hợp lệ.",
  unknown_store:
    "Không xác định được cửa hàng. Vui lòng truy cập bằng liên kết của cửa hàng.",
  campaign_not_configured: "Chương trình quay thưởng chưa được cấu hình.",
  campaign_not_started: "Chương trình quay thưởng chưa bắt đầu.",
  campaign_ended: "Chương trình quay thưởng đã kết thúc.",
  daily_limit_reached: "Bạn đã dùng hết lượt quay hôm nay.",
  invoice_amount_too_low: "Hóa đơn chưa đạt mức tối thiểu để quay.",
  no_prizes_available: "Rất tiếc, phần quà hôm nay đã hết.",
  no_active_wheel: "Vòng quay hiện chưa sẵn sàng, vui lòng thử lại sau.",
  prize_not_mapped_to_wheel:
    "Vòng quay hiện chưa sẵn sàng, vui lòng thử lại sau.",
  assigned_prize_missing:
    "Có lỗi khi áp dụng phần quà được chỉ định trước. Vui lòng liên hệ quản trị viên.",
};

export async function POST(request: Request) {
  let body: {
    storeCode?: string;
    name?: string;
    phone?: string;
    invoiceAmount?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const storeCode = (body.storeCode ?? "").trim();
  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const invoiceAmount =
    typeof body.invoiceAmount === "number" && Number.isFinite(body.invoiceAmount)
      ? body.invoiceAmount
      : null;

  if (!storeCode) {
    return NextResponse.json(
      { error: "unknown_store", message: ERROR_MESSAGES.unknown_store },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("fn_spin", {
    p_store_code: storeCode,
    p_name: name,
    p_phone: phone,
    p_invoice_amount: invoiceAmount,
  });

  if (error) {
    const code = toSpinErrorCode(error.message);
    let message = ERROR_MESSAGES[code];
    if (code === "invoice_amount_too_low") {
      const { data: settings } = await supabase
        .from("campaign_settings")
        .select("min_invoice_amount")
        .eq("id", 1)
        .maybeSingle();
      if (settings?.min_invoice_amount) {
        message = `Hóa đơn phải từ ${Number(settings.min_invoice_amount).toLocaleString("vi-VN")}đ trở lên mới được quay.`;
      }
    }
    return NextResponse.json({ error: code, message }, { status: 400 });
  }

  return NextResponse.json(data);
}
