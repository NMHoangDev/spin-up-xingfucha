import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: wheelFace, error } = await supabase
    .from("wheel_faces")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!wheelFace) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: slices } = await supabase
    .from("wheel_slices")
    .select("slot_index, start_angle, end_angle, prize_id")
    .eq("wheel_face_id", id)
    .order("slot_index", { ascending: true });

  return NextResponse.json({
    id: wheelFace.id,
    name: wheelFace.name,
    imagePath: wheelFace.image_path,
    sliceCount: wheelFace.slice_count,
    isActive: wheelFace.is_active,
    slices: (slices ?? []).map((s) => ({
      slotIndex: s.slot_index,
      startAngle: Number(s.start_angle),
      endAngle: Number(s.end_angle),
      prizeId: s.prize_id,
    })),
  });
}

type SliceInput = {
  slotIndex: number;
  startAngle: number;
  endAngle: number;
  prizeId: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { name?: string; slices?: SliceInput[]; activate?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  if (body.name) {
    await supabase
      .from("wheel_faces")
      .update({ name: body.name.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  if (Array.isArray(body.slices)) {
    for (const s of body.slices) {
      if (
        typeof s.slotIndex !== "number" ||
        typeof s.startAngle !== "number" ||
        typeof s.endAngle !== "number" ||
        s.startAngle < 0 ||
        s.endAngle > 360 ||
        s.startAngle >= s.endAngle
      ) {
        return NextResponse.json(
          { error: "invalid_slice_data" },
          { status: 400 },
        );
      }
    }

    await supabase.from("wheel_slices").delete().eq("wheel_face_id", id);
    if (body.slices.length > 0) {
      const { error: insertError } = await supabase.from("wheel_slices").insert(
        body.slices.map((s) => ({
          wheel_face_id: id,
          slot_index: s.slotIndex,
          start_angle: s.startAngle,
          end_angle: s.endAngle,
          prize_id: s.prizeId,
        })),
      );
      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 400 },
        );
      }
    }
    await supabase
      .from("wheel_faces")
      .update({
        slice_count: body.slices.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  if (body.activate) {
    await supabase.from("wheel_faces").update({ is_active: false }).neq("id", id);
    await supabase.from("wheel_faces").update({ is_active: true }).eq("id", id);
    await supabase
      .from("campaign_settings")
      .update({ active_wheel_face_id: id, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }

  const { data: wheelFace } = await supabase
    .from("wheel_faces")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const { data: slices } = await supabase
    .from("wheel_slices")
    .select("slot_index, start_angle, end_angle, prize_id")
    .eq("wheel_face_id", id)
    .order("slot_index", { ascending: true });

  return NextResponse.json({
    id: wheelFace?.id,
    name: wheelFace?.name,
    imagePath: wheelFace?.image_path,
    sliceCount: wheelFace?.slice_count,
    isActive: wheelFace?.is_active,
    slices: (slices ?? []).map((s) => ({
      slotIndex: s.slot_index,
      startAngle: Number(s.start_angle),
      endAngle: Number(s.end_angle),
      prizeId: s.prize_id,
    })),
  });
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
    .eq("wheel_face_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      {
        error: "has_spin_history",
        message:
          "Mặt vòng quay này đã có lượt quay gắn với nó — không thể xoá để giữ lịch sử báo cáo.",
      },
      { status: 409 },
    );
  }

  const { data: settings } = await supabase
    .from("campaign_settings")
    .select("active_wheel_face_id")
    .eq("id", 1)
    .maybeSingle();

  if (settings?.active_wheel_face_id === id) {
    return NextResponse.json(
      {
        error: "is_active",
        message: "Không thể xoá vòng quay đang được sử dụng.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("wheel_faces").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
