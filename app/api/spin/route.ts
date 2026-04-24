import { NextRequest, NextResponse } from "next/server";

import { selectRewardForSpinFlow } from "@/lib/rewards/spin-flow";
import { createSpinRecord, getSpinEligibility } from "@/lib/spins/store";
import {
  createSpinRecordFirebase,
  getSpinEligibilityFirebase,
} from "@/lib/spins/firebase-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shouldUseFirebaseBackend() {
  return process.env.SPIN_DATA_BACKEND === "firebase";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const deviceFingerprint = String(body?.deviceFingerprint ?? "").trim();

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Missing name or phone" },
        { status: 400 },
      );
    }

    const backend = shouldUseFirebaseBackend() ? "firebase" : "mysql";
    const eligibility =
      backend === "firebase"
        ? await getSpinEligibilityFirebase({ name, phone })
        : await getSpinEligibility({ name, phone });

    if (eligibility.spinsToday >= eligibility.maxSpinsToday) {
      return NextResponse.json(
        {
          code: "DAILY_USER_LIMIT_REACHED",
          error: `Khách hàng này đã dùng hết ${eligibility.maxSpinsToday} lượt quay hôm nay.`,
          maxSpinsToday: eligibility.maxSpinsToday,
          nextAvailableAt: eligibility.nextAvailableAt,
        },
        { status: 409 },
      );
    }

    const spinNumberToday = eligibility.spinsToday + 1;
    const selection = selectRewardForSpinFlow();

    const spin =
      backend === "firebase"
        ? await createSpinRecordFirebase({
            name,
            phone,
            deviceFingerprint,
            rewardIndex: selection.index,
            rewardId: selection.reward.id,
            rewardLabel: selection.reward.label,
            rewardType: selection.reward.type,
            rewardCode: selection.reward.code ?? null,
          })
        : await createSpinRecord({
            name,
            phone,
            deviceFingerprint,
            rewardIndex: selection.index,
            rewardId: selection.reward.id,
            rewardLabel: selection.reward.label,
            rewardType: selection.reward.type,
            rewardCode: selection.reward.code ?? null,
          });

    return NextResponse.json({
      success: true,
      backend,
      spinId: spin.id,
      rewardIndex: selection.index,
      limits: {
        maxSpinsToday: eligibility.maxSpinsToday,
        spinsUsedToday: spinNumberToday,
      },
      reward: {
        ...selection.reward,
        voucherDelayMinutes: spin.voucherDelayMinutes,
        voucherUsableFrom: spin.voucherUsableFrom,
        voucherExpiresAt: spin.voucherExpiresAt,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      process.env.NODE_ENV === "production"
        ? { error: "Internal Server Error" }
        : { error: "Internal Server Error", detail },
      { status: 500 },
    );
  }
}
