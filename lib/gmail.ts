import nodemailer from "nodemailer";

/** Sends mail through Gmail's SMTP server, authenticated as a regular Gmail
 * mailbox using an App Password (not the account's normal login password) —
 * see the "Thông báo đến các quản lý" setup notes for how to generate one.
 * Server-only. */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const user = requireEnv("GMAIL_SENDER_EMAIL");
  const pass = requireEnv("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cachedTransporter;
}

export type SendEmailAttachment = {
  filename: string;
  content: Buffer;
  /** Referenced from the HTML body as `<img src="cid:...">` to embed the
   * image inline instead of listing it as a separate download. */
  cid: string;
  contentType?: string;
};

export type SendEmailInput = {
  /** May be a single address or a comma-separated list. */
  to: string;
  subject: string;
  html: string;
  attachments?: SendEmailAttachment[];
};

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: SendEmailInput): Promise<void> {
  const from = requireEnv("GMAIL_SENDER_EMAIL");
  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject, html, attachments });
}
