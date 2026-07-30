import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: existing, error: fetchError } = await supabase
    .from("assigned_gifts")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      {
        error: "not_pending",
        message: "Chỉ có thể huỷ chỉ định đang chờ khách quay.",
      },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("assigned_gifts")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
