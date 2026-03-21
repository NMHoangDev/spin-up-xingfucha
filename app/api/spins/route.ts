import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function timestampToIso(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value?.toDate) return value.toDate().toISOString();
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = toInt(searchParams.get("page"), 1);
    const limit = Math.min(toInt(searchParams.get("limit"), 10), 100);
    const search = (searchParams.get("search") ?? "").trim();
    const type = (searchParams.get("type") ?? "all").trim();

    const db = getDb();
    let query = db.collection("spins").orderBy("createdAt", "desc");
    if (type && type !== "all") {
      query = query.where("rewardType", "==", type);
    }

    let total: number | null = null;
    try {
      const countSnap = await query.count().get();
      total = countSnap.data().count as number;
    } catch {
      total = null;
    }

    const offset = (page - 1) * limit;
    const fetchLimit = Math.max(limit + offset, 200);
    const snap = await query.limit(fetchLimit).get();

    type SpinRow = {
      id: string;
      name: string;
      phone: string;
      rewardCode: string;
      rewardLabel: string;
      rewardType: string;
      createdAt: string | null;
      status: "used" | "unused";
    };

    let rows: SpinRow[] = snap.docs.map((doc: any) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        name: data.name ?? "",
        phone: data.phone ?? "",
        rewardCode: data.rewardCode ?? "",
        rewardLabel: data.rewardLabel ?? "",
        rewardType: data.rewardType ?? "",
        createdAt: timestampToIso(data.createdAt),
        status: (data.status === "used" ? "used" : "unused") as
          | "used"
          | "unused",
      };
    });

    if (search) {
      const lowered = search.toLowerCase();
      rows = rows.filter(
        (r: SpinRow) =>
          r.phone.includes(search) || r.name.toLowerCase().includes(lowered),
      );
    }

    const data = rows.slice(offset, offset + limit);

    return NextResponse.json({
      data,
      total: total ?? rows.length,
    });
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Firebase Admin not configured or request failed",
        detail,
        hint: "Firebase Admin credentials are hardcoded. Check `lib/firebase/admin.ts` and ensure the service account JSON file exists in the project root.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body as { id?: string; status?: "used" | "unused" };

    if (!id || (status !== "used" && status !== "unused")) {
      return NextResponse.json(
        { error: "Missing id or invalid status" },
        { status: 400 },
      );
    }

    const db = getDb();
    await db.collection("spins").doc(id).update({ status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Firebase Admin not configured or request failed", detail },
      { status: 500 },
    );
  }
}
