import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { PageTheme } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function toCamel(row: any): PageTheme {
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

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("page_theme")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_configured" }, { status: 404 });
  return NextResponse.json(toCamel(data));
}

export async function PATCH(request: Request) {
  let body: Partial<PageTheme>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("backgroundColor" in body) update.background_color = body.backgroundColor;
  if ("backgroundImagePath" in body)
    update.background_image_path = body.backgroundImagePath;
  if ("sectionBackgroundColor" in body)
    update.section_background_color = body.sectionBackgroundColor;
  if ("sectionBackgroundImagePath" in body)
    update.section_background_image_path = body.sectionBackgroundImagePath;
  if ("spinButtonColor" in body) update.spin_button_color = body.spinButtonColor;
  if ("spinButtonTextColor" in body)
    update.spin_button_text_color = body.spinButtonTextColor;
  if ("spinButtonText" in body) update.spin_button_text = body.spinButtonText;
  if ("revealAnimation" in body) update.reveal_animation = body.revealAnimation;
  update.updated_at = new Date().toISOString();

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("page_theme")
    .update(update)
    .eq("id", 1)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(toCamel(data));
}
