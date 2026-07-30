import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServiceClient();

  const { data: settings, error: settingsError } = await supabase
    .from("campaign_settings")
    .select("active_wheel_face_id, starts_at, ends_at, wallet_enabled, min_invoice_amount")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }

  const minInvoiceAmount =
    settings?.min_invoice_amount == null ? null : Number(settings.min_invoice_amount);

  if (!settings || !settings.active_wheel_face_id) {
    return NextResponse.json(
      { ready: false, campaignOpen: false, walletEnabled: false, minInvoiceAmount: null },
      { status: 200 },
    );
  }

  const now = Date.now();
  const campaignOpen =
    (!settings.starts_at || new Date(settings.starts_at).getTime() <= now) &&
    (!settings.ends_at || new Date(settings.ends_at).getTime() >= now);

  const { data: wheelFace, error: wheelFaceError } = await supabase
    .from("wheel_faces")
    .select("id, name, image_path, slice_count")
    .eq("id", settings.active_wheel_face_id)
    .maybeSingle();

  if (wheelFaceError || !wheelFace) {
    return NextResponse.json(
      {
        ready: false,
        campaignOpen,
        walletEnabled: settings.wallet_enabled,
        minInvoiceAmount,
      },
      { status: 200 },
    );
  }

  const { data: slices } = await supabase
    .from("wheel_slices")
    .select("slot_index, start_angle, end_angle, prize_id, prizes(label)")
    .eq("wheel_face_id", wheelFace.id)
    .order("slot_index");

  return NextResponse.json({
    ready: true,
    campaignOpen,
    walletEnabled: settings.wallet_enabled,
    minInvoiceAmount,
    wheelFace: {
      id: wheelFace.id,
      name: wheelFace.name,
      imagePath: wheelFace.image_path,
      sliceCount: wheelFace.slice_count,
    },
    slices: (slices ?? []).map((s) => ({
      slotIndex: s.slot_index,
      startAngle: Number(s.start_angle),
      endAngle: Number(s.end_angle),
      prizeId: s.prize_id,
      prizeLabel: (s.prizes as unknown as { label: string } | null)?.label ?? null,
    })),
  });
}
