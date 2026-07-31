import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Vercel sets this on every deployment automatically — no config needed.
 * Falls back to a constant locally, where there's nothing to detect. */
export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev";
  return NextResponse.json({ version });
}
