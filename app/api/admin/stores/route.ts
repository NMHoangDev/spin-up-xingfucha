import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    items: (data ?? []).map(
      (row): Store => ({
        code: row.code,
        name: row.name,
        active: row.active,
        managerEmail: row.manager_email,
      }),
    ),
  });
}

export async function POST(request: Request) {
  let body: Partial<Store>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.code?.trim() || !body.name?.trim()) {
    return NextResponse.json(
      { error: "code_and_name_required" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({
      code: body.code.trim(),
      name: body.name.trim(),
      active: body.active ?? true,
    })
    .select("*")
    .single();

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
