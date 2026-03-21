"use client";

import { getFirestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { getFirebaseApp } from "@/lib/firebase/client";

export type SpinReward = {
  code?: string;
  label: string;
};

export type HandleSpinSubmitInput = {
  name: string;
  phone: string;
  reward: SpinReward;
};

export type HandleSpinSubmitResult = {
  spinCount: number;
  reward: SpinReward;
  docId: string;
};

function normalizePhone(phone: string): string {
  return phone.trim();
}

/**
 * Upsert spin tracking record by phone.
 *
 * Collection: spin_results
 * Fields:
 * - name, phone, rewardCode, rewardLabel, spinCount, createdAt, updatedAt
 */
export async function handleSpinSubmit({
  name,
  phone,
  reward,
}: HandleSpinSubmitInput): Promise<HandleSpinSubmitResult> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new Error("Phone is required");
  }

  const app = getFirebaseApp();
  if (!app) {
    throw new Error("Firebase is not configured");
  }

  const db = getFirestore(app);

  try {
    const colRef = collection(db, "spin_results");
    const q = query(colRef, where("phone", "==", normalizedPhone));
    const snap = await getDocs(q);

    const rewardCode = reward.code ?? "";
    const rewardLabel = reward.label;

    if (!snap.empty) {
      const docRef = snap.docs[0]!.ref;
      const prevSpinCount = Number(snap.docs[0]!.data()?.spinCount ?? 0);

      await updateDoc(docRef, {
        name,
        phone: normalizedPhone,
        rewardCode,
        rewardLabel,
        spinCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      return {
        docId: snap.docs[0]!.id,
        spinCount: prevSpinCount + 1,
        reward,
      };
    }

    const created = await addDoc(colRef, {
      name,
      phone: normalizedPhone,
      rewardCode,
      rewardLabel,
      spinCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      docId: created.id,
      spinCount: 1,
      reward,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown Firestore error";
    throw new Error(`Failed to save spin result: ${message}`);
  }
}
