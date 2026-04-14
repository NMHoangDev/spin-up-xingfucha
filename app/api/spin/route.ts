import { NextRequest, NextResponse } from "next/server";

import { createSeededRng } from "@/lib/rewards/reward.service";
import { selectRewardForSpinFlow } from "@/lib/rewards/spin-flow";
import {
  createSpinRecord,
  getSpinEligibility,
} from "@/lib/spins/store";
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

    if (!name || !phone || !deviceFingerprint) {
      return NextResponse.json(
        { error: "Missing name, phone, or device fingerprint" },
        { status: 400 },
      );
    }

    const backend = shouldUseFirebaseBackend() ? "firebase" : "mysql";
    const eligibility =
      backend === "firebase"
        ? await getSpinEligibilityFirebase({ deviceFingerprint })
        : await getSpinEligibility({ deviceFingerprint });

    if (eligibility.hasReachedGlobalDeviceCap) {
      return NextResponse.json(
        {
          code: "DAILY_DEVICE_POOL_LIMIT_REACHED",
          error: "Đã tới giới hạn lượt quay hôm nay.",
          nextAvailableAt: eligibility.nextAvailableAt,
        },
        { status: 409 },
      );
    }

    if (eligibility.deviceSpinsToday >= eligibility.maxSpinsToday) {
      return NextResponse.json(
        {
          code: "DEVICE_TIER_LIMIT_REACHED",
          error: `Thiết bị này đã dùng hết ${eligibility.maxSpinsToday} lượt quay hôm nay.`,
          maxSpinsToday: eligibility.maxSpinsToday,
          nextAvailableAt: eligibility.nextAvailableAt,
        },
        { status: 409 },
      );
    }

    const spinNumberToday = eligibility.deviceSpinsToday + 1;
    const seed = `${deviceFingerprint}-${eligibility.deviceRankToday}-${spinNumberToday}`;
    const selection = selectRewardForSpinFlow({
      maxSpinsToday: eligibility.maxSpinsToday,
      spinNumberToday,
      rng: createSeededRng(seed),
    });

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
        deviceRankToday: eligibility.deviceRankToday,
        maxSpinsToday: eligibility.maxSpinsToday,
        spinsUsedToday: spinNumberToday,
        distinctDevicesToday: Math.max(
          eligibility.distinctDevicesToday,
          eligibility.deviceRankToday,
        ),
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
