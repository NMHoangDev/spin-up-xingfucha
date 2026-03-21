import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { REWARDS } from "@/lib/rewards/rewards";
import { selectWeightedReward } from "@/lib/rewards/reward.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Missing name or phone" },
        { status: 400 },
      );
    }

    // Weighted reward selection (production-safe)
    // Optional deterministic seed for testing: POST /api/spin?seed=demo
    const seed = new URL(req.url).searchParams.get("seed") ?? undefined;
    const selection = selectWeightedReward({ rewards: REWARDS, seed });
    const randomIndex = selection.index;
    const reward = selection.reward;

    // Save spin to Firestore (required)
    const db = getDb();
    await db.collection("spins").add({
      name,
      phone,
      rewardIndex: randomIndex,
      rewardId: reward.id,
      rewardLabel: reward.label,
      rewardType: reward.type,
      rewardCode: reward.code ?? null,
      status: "unused",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      rewardIndex: randomIndex,
      reward: reward,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
