import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { PageTheme, PageThemeElement } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function themeToCamel(row: any): PageTheme {
  return {
    backgroundColor: row.background_color,
    backgroundImagePath: row.background_image_path,
    sectionBackgroundColor: row.section_background_color,
    sectionBackgroundImagePath: row.section_background_image_path,
    spinButtonColor: row.spin_button_color,
    spinButtonTextColor: row.spin_button_text_color,
    spinButtonText: row.spin_button_text,
    revealAnimation: row.reveal_animation,
  };
}

function elementToCamel(row: any): PageThemeElement {
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
    isVisible: row.is_visible,
  };
}

export async function GET() {
  const supabase = createSupabaseServiceClient();

  const [{ data: theme, error: themeError }, { data: elements, error: elementsError }] =
    await Promise.all([
      supabase.from("page_theme").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("page_theme_elements")
        .select("*")
        .eq("is_visible", true)
        .order("z_index", { ascending: true }),
    ]);

  if (themeError || elementsError) {
    return NextResponse.json(
      { error: (themeError ?? elementsError)?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    theme: theme ? themeToCamel(theme) : null,
    elements: (elements ?? []).map(elementToCamel),
  });
}
