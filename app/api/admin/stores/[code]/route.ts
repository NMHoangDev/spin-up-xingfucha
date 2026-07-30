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
  if ("managerEmail" in body) {
    const raw = (body as { managerEmail?: string | null }).managerEmail;
    const trimmed = raw?.trim() || null;
    if (trimmed) {
      const addresses = trimmed.split(/[,;]/).map((a) => a.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (addresses.some((a) => !emailRegex.test(a))) {
        return NextResponse.json({ error: "invalid_email" }, { status: 400 });
      }
    }
    update.manager_email = trimmed;
  }

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
    managerEmail: data.manager_email,
  });
}
