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

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("page_theme_elements")
    .select("*")
    .order("z_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map(toCamel) });
}

export async function POST(request: Request) {
  let body: Partial<PageThemeElement>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (body.kind === "wheel_disk" || body.kind === "pointer") {
    return NextResponse.json(
      { error: "kind_not_creatable" },
      { status: 400 },
    );
  }
  if (body.kind !== "image" && body.kind !== "text") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  if (!body.canvas || !["header", "wheel"].includes(body.canvas)) {
    return NextResponse.json({ error: "invalid_canvas" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: maxZ } = await supabase
    .from("page_theme_elements")
    .select("z_index")
    .order("z_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("page_theme_elements")
    .insert({
      kind: body.kind,
      canvas: body.canvas,
      image_path: body.imagePath ?? null,
      text_content: body.textContent ?? null,
      text_color: body.textColor ?? "#8f111a",
      font_size: body.fontSize ?? 16,
      x: body.x ?? 30,
      y: body.y ?? 30,
      width: body.width ?? 20,
      height: body.height ?? 20,
      rotation: body.rotation ?? 0,
      z_index: (maxZ?.z_index ?? -1) + 1,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(toCamel(data));
}
