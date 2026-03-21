import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import serviceAccountJson from "@/hp-task-firebase-adminsdk-fbsvc-977796e5ae.json";

type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function getHardcodedServiceAccount() {
  const json = serviceAccountJson as unknown as ServiceAccountJson;
  const projectId = json.project_id;
  const clientEmail = json.client_email;
  const privateKeyRaw = json.private_key;
  const privateKey = privateKeyRaw?.includes("\\n")
    ? privateKeyRaw.replace(/\\n/g, "\n")
    : privateKeyRaw;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin service account is missing required fields (project_id/client_email/private_key).",
    );
  }

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminApp() {
  if (getApps().length) return getApps()[0]!;

  const { projectId, clientEmail, privateKey } = getHardcodedServiceAccount();

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getDb() {
  getFirebaseAdminApp();
  return getFirestore();
}
