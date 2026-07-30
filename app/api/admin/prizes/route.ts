import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Prize } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function toCamel(row: any): Prize {
  return {
    id: row.id,
    label: row.label,
    code: row.code,
    weight: Number(row.weight),
    dailyLimit: row.daily_limit,
    totalLimit: row.total_limit,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("prizes")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: (data ?? []).map(toCamel) });
}

export async function POST(request: Request) {
  let body: Partial<Prize>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.label || !body.label.trim()) {
    return NextResponse.json({ error: "label_required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: maxSort } = await supabase
    .from("prizes")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("prizes")
    .insert({
      label: body.label.trim(),
      code: body.code?.trim() || null,
      weight: body.weight ?? 0,
      daily_limit: body.dailyLimit ?? null,
      total_limit: body.totalLimit ?? null,
      is_active: body.isActive ?? true,
      sort_order: (maxSort?.sort_order ?? -1) + 1,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(toCamel(data));
}
