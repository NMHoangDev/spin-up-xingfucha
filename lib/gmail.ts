import { google } from "googleapis";

/** Sends mail as a specific Workspace mailbox via a service account with
 * domain-wide delegation — see README/setup notes for how the service
 * account JSON and sender mailbox are provisioned. Server-only. */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function getServiceAccountCredentials(): { client_email: string; private_key: string } {
  const raw = requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_service_account_json");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("invalid_service_account_json");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function encodeSubjectHeader(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

function buildRawMessage(input: { to: string; from: string; subject: string; html: string }): string {
  const lines = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubjectHeader(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
  ];
  return Buffer.from(lines.join("\r\n"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null;
let cachedAuthSubject: string | null = null;

function getJwtClient(subject: string) {
  if (cachedAuth && cachedAuthSubject === subject) return cachedAuth;
  const creds = getServiceAccountCredentials();
  cachedAuth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject,
  });
  cachedAuthSubject = subject;
  return cachedAuth;
}

export type SendEmailInput = {
  /** May be a single address or a comma-separated list. */
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const senderEmail = requireEnv("GMAIL_SENDER_EMAIL");
  const auth = getJwtClient(senderEmail);
  const gmail = google.gmail({ version: "v1", auth });
  const raw = buildRawMessage({ to, from: senderEmail, subject, html });
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}
