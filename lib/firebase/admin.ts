import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

function requiredEnv(name: string, fallbacks: string[] = []): string {
  const candidates = [name, ...fallbacks];
  for (const key of candidates) {
    const value = process.env[key];
    if (value) return value;
  }

  throw new Error(
    `Missing env var: ${name}. Set Firebase Admin credentials via FIREBASE_SERVICE_ACCOUNT_PATH (recommended for local) or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local.`,
  );
}

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function loadServiceAccountFromPath(filePath: string) {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Service account file not found at: ${resolved}. Set FIREBASE_SERVICE_ACCOUNT_PATH to a valid path.`,
    );
  }

  const raw = fs.readFileSync(resolved, "utf8");
  const json = JSON.parse(raw) as ServiceAccountJson;

  const projectId = json.project_id;
  const clientEmail = json.client_email;
  const privateKey = json.private_key;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Invalid service account JSON: missing project_id/client_email/private_key.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdminApp() {
  if (getApps().length) return getApps()[0]!;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const { projectId, clientEmail, privateKey } =
      loadServiceAccountFromPath(serviceAccountPath);
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  const projectId = requiredEnv("FIREBASE_PROJECT_ID", [
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  ]);
  const clientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");

  // Vercel/Windows often store multiline keys with escaped newlines
  const privateKeyRaw = requiredEnv("FIREBASE_PRIVATE_KEY");
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

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
