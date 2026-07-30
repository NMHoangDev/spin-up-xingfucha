import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth-aware client bound to the request's cookies — used only to read/write
 * the admin's Supabase Auth session (login/logout/getUser). Never used for
 * spin data: RLS has no policies for the anon/authenticated role on our
 * tables, so this client cannot read them even if asked to.
 */
export async function createSupabaseServerAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render, where cookies can't be
            // written — the middleware refresh on the next request covers it.
          }
        },
      },
    },
  );
}
