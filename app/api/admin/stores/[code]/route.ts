import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  let body: Partial<Store>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("name" in body) update.name = body.name?.trim();
  if ("active" in body) update.active = body.active;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .update(update)
    .eq("code", code)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({
    code: data.code,
    name: data.name,
    active: data.active,
  });
}
