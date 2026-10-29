import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

/**
 * Supabase-client met de sessie uit de cookies. Wordt alleen voor Auth gebruikt
 * (inloggen, tweestapsverificatie); data gaat via src/lib/db.ts.
 */
export async function createUserClient() {
  const cookieStore = await cookies();

  return createServerClient(env.SUPABASE_INTERNAL_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components mogen cookies lezen maar niet schrijven;
          // proxy.ts ververst de sessie.
        }
      },
    },
  });
}
