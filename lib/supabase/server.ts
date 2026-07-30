import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — full DB access, bypasses RLS. Server-only: every
 * `/api/**` route uses this for actual data reads/writes. Never import this
 * from a Client Component or expose the key it uses to the browser.
 */
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
