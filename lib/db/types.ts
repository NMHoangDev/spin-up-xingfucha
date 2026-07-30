export type Store = {
  code: string;
  name: string;
  active: boolean;
};

export type Prize = {
  id: string;
  label: string;
  code: string | null;
  weight: number;
  dailyLimit: number | null;
  totalLimit: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type WheelSlice = {
  id: string;
  wheelFaceId: string;
  slotIndex: number;
  startAngle: number;
  endAngle: number;
  prizeId: string | null;
  prizeLabel?: string | null;
};

export type WheelFace = {
  id: string;
  name: string;
  imagePath: string;
  sliceCount: number;
  isActive: boolean;
};

export type CampaignSettings = {
  activeWheelFaceId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  maxSpinsPerCustomerPerDay: number;
  walletEnabled: boolean;
  voucherUsableFrom: string | null;
  voucherExpiresAt: string | null;
  voucherActivationDelayMinutes: number | null;
  voucherValidityDays: number | null;
  maxVoucherUsesPerDay: number;
  minInvoiceAmount: number | null;
};

export type SpinStatus = "used" | "unused";

export type SpinRecord = {
  id: string;
  storeCode: string;
  customerName: string;
  customerPhone: string;
  prizeId: string;
  prizeLabel: string | null;
  prizeCode: string | null;
  wheelFaceId: string | null;
  slotIndex: number | null;
  status: SpinStatus;
  voucherUsableFrom: string | null;
  voucherExpiresAt: string | null;
  usedAt: string | null;
  invoiceAmount: number | null;
  createdAt: string;
};

export type RevealAnimation = "box_open" | "fireworks" | "curtain";

export type PageTheme = {
  backgroundColor: string | null;
  backgroundImagePath: string | null;
  sectionBackgroundColor: string | null;
  sectionBackgroundImagePath: string | null;
  spinButtonColor: string;
  spinButtonTextColor: string;
  spinButtonText: string;
  revealAnimation: RevealAnimation;
};

export type ThemeElementKind = "image" | "text" | "wheel_disk" | "pointer";
export type ThemeCanvas = "header" | "wheel";

export type PageThemeElement = {
  id: string;
  kind: ThemeElementKind;
  canvas: ThemeCanvas;
  imagePath: string | null;
  textContent: string | null;
  textColor: string | null;
  fontSize: number | null;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  rotation: number;
  angleDeg: number | null;
  distancePx: number | null;
  zIndex: number;
};

export type AssignedGiftStatus = "pending" | "fulfilled" | "cancelled";

export type AssignedGift = {
  id: string;
  phone: string;
  prizeId: string;
  prizeLabel: string | null;
  prizeCode: string | null;
  status: AssignedGiftStatus;
  note: string | null;
  existingCustomerName: string | null;
  spinId: string | null;
  fulfilledStoreCode: string | null;
  fulfilledCustomerName: string | null;
  createdAt: string;
  fulfilledAt: string | null;
};

/** Error codes `fn_spin`/`fn_redeem_voucher` raise as their PG exception message. */
export const SPIN_ERROR_CODES = [
  "invalid_name",
  "invalid_phone",
  "unknown_store",
  "campaign_not_configured",
  "campaign_not_started",
  "campaign_ended",
  "daily_limit_reached",
  "invoice_amount_too_low",
  "no_prizes_available",
  "no_active_wheel",
  "prize_not_mapped_to_wheel",
  "assigned_prize_missing",
] as const;
export type SpinErrorCode = (typeof SPIN_ERROR_CODES)[number];

export const REDEEM_ERROR_CODES = [
  "not_found",
  "already_used",
  "not_usable_yet",
  "expired",
  "daily_usage_limit_reached",
] as const;
export type RedeemErrorCode = (typeof REDEEM_ERROR_CODES)[number];

export function toSpinErrorCode(message: string | undefined): SpinErrorCode {
  return (SPIN_ERROR_CODES as readonly string[]).includes(message ?? "")
    ? (message as SpinErrorCode)
    : "campaign_not_configured";
}

export function toRedeemErrorCode(
  message: string | undefined,
): RedeemErrorCode {
  return (REDEEM_ERROR_CODES as readonly string[]).includes(message ?? "")
    ? (message as RedeemErrorCode)
    : "not_found";
}
