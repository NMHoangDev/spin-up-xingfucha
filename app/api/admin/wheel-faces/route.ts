import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUCKET = "wheel-faces";
const MAX_SIZE = 5 * 1024 * 1024;

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("wheel_faces")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    items: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      imagePath: row.image_path,
      sliceCount: row.slice_count,
      isActive: row.is_active,
    })),
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("image");

  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image_required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "invalid_image_type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "image_too_large" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const ext = (file.name.split(".").pop() || "webp").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  const { data: activePrizes } = await supabase
    .from("prizes")
    .select("id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const prizeIds = (activePrizes ?? []).map((p) => p.id);
  // New faces always start at the standard 4 slices regardless of how many
  // prizes happen to be active right now — the admin freely adds/removes
  // slots afterward in "Chỉnh vị trí" to match their uploaded artwork.
  const DEFAULT_SLICE_COUNT = 4;
  const n = DEFAULT_SLICE_COUNT;

  const { data: wheelFace, error: insertError } = await supabase
    .from("wheel_faces")
    .insert({
      name,
      image_path: publicUrlData.publicUrl,
      slice_count: n,
      is_active: false,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const sliceAngle = 360 / n;
  const slices = Array.from({ length: n }, (_, i) => ({
    wheel_face_id: wheelFace.id,
    slot_index: i,
    start_angle: i * sliceAngle,
    end_angle: (i + 1) * sliceAngle,
    prize_id: prizeIds.length > 0 ? prizeIds[i % prizeIds.length] : null,
  }));
  await supabase.from("wheel_slices").insert(slices);

  return NextResponse.json({
    id: wheelFace.id,
    name: wheelFace.name,
    imagePath: wheelFace.image_path,
    sliceCount: wheelFace.slice_count,
    isActive: wheelFace.is_active,
  });
}
