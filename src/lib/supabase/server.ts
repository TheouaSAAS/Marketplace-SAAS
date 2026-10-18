import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client lié à la SESSION de l'utilisateur (cookies d'authentification).
 * À utiliser dans les Server Components, Server Actions et Route Handlers qui
 * dépendent de l'utilisateur connecté. Les règles RLS s'appliquent avec son identité.
 *
 * Lit `cookies()` : avec Cache Components, le composant appelant doit être
 * placé derrière un <Suspense>. Créer un nouveau client à chaque requête.
 */
export async function createSessionSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appel depuis un Server Component (écriture impossible) : le proxy
          // rafraîchit la session à la requête suivante (mis en place en phase 4).
        }
      },
    },
  });
}
