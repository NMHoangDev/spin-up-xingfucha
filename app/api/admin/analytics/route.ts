import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? new Date(0).toISOString();
  const to = searchParams.get("to") ?? new Date().toISOString();
  const storesParam = searchParams.get("stores");
  const storeCodes = storesParam ? storesParam.split(",").filter(Boolean) : null;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("fn_admin_analytics", {
    p_from: from,
    p_to: to,
    p_store_codes: storeCodes,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
