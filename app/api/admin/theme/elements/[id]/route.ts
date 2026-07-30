import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { PageThemeElement } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function toCamel(row: any): PageThemeElement {
  return {
    id: row.id,
    kind: row.kind,
    canvas: row.canvas,
    imagePath: row.image_path,
    textContent: row.text_content,
    textColor: row.text_color,
    fontSize: row.font_size,
    x: Number(row.x),
    y: Number(row.y),
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    rotation: Number(row.rotation),
    angleDeg: row.angle_deg === null ? null : Number(row.angle_deg),
    distancePx: row.distance_px === null ? null : Number(row.distance_px),
    zIndex: row.z_index,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: Partial<PageThemeElement>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("imagePath" in body) update.image_path = body.imagePath;
  if ("textContent" in body) update.text_content = body.textContent;
  if ("textColor" in body) update.text_color = body.textColor;
  if ("fontSize" in body) update.font_size = body.fontSize;
  if ("x" in body) update.x = body.x;
  if ("y" in body) update.y = body.y;
  if ("width" in body) update.width = body.width;
  if ("height" in body) update.height = body.height;
  if ("rotation" in body) update.rotation = body.rotation;
  if ("angleDeg" in body) update.angle_deg = body.angleDeg;
  if ("distancePx" in body) update.distance_px = body.distancePx;
  if ("zIndex" in body) update.z_index = body.zIndex;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("page_theme_elements")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(toCamel(data));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: existing } = await supabase
    .from("page_theme_elements")
    .select("kind")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.kind === "wheel_disk" || existing.kind === "pointer") {
    return NextResponse.json(
      {
        error: "kind_not_deletable",
        message: "Không thể xoá vòng quay hoặc mũi tên.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("page_theme_elements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
