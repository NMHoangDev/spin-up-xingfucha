import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { CampaignSettings } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function toCamel(row: any): CampaignSettings {
  return {
    activeWheelFaceId: row.active_wheel_face_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    maxSpinsPerCustomerPerDay: row.max_spins_per_customer_per_day,
    walletEnabled: row.wallet_enabled,
    voucherUsableFrom: row.voucher_usable_from,
    voucherExpiresAt: row.voucher_expires_at,
    voucherActivationDelayMinutes: row.voucher_activation_delay_minutes,
    voucherValidityDays: row.voucher_validity_days,
    maxVoucherUsesPerDay: row.max_voucher_uses_per_day,
    minInvoiceAmount: row.min_invoice_amount === null ? null : Number(row.min_invoice_amount),
  };
}

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("campaign_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }
  return NextResponse.json(toCamel(data));
}

export async function PATCH(request: Request) {
  let body: Partial<CampaignSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("startsAt" in body) update.starts_at = body.startsAt;
  if ("endsAt" in body) update.ends_at = body.endsAt;
  if ("maxSpinsPerCustomerPerDay" in body)
    update.max_spins_per_customer_per_day = body.maxSpinsPerCustomerPerDay;
  if ("walletEnabled" in body) update.wallet_enabled = body.walletEnabled;
  if ("voucherUsableFrom" in body)
    update.voucher_usable_from = body.voucherUsableFrom;
  if ("voucherExpiresAt" in body)
    update.voucher_expires_at = body.voucherExpiresAt;
  if ("voucherActivationDelayMinutes" in body)
    update.voucher_activation_delay_minutes =
      body.voucherActivationDelayMinutes;
  if ("voucherValidityDays" in body)
    update.voucher_validity_days = body.voucherValidityDays;
  if ("maxVoucherUsesPerDay" in body)
    update.max_voucher_uses_per_day = body.maxVoucherUsesPerDay;
  if ("minInvoiceAmount" in body) update.min_invoice_amount = body.minInvoiceAmount;
  update.updated_at = new Date().toISOString();

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("campaign_settings")
    .update(update)
    .eq("id", 1)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(toCamel(data));
}
