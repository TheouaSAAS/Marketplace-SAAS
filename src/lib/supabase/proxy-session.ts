import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Vrai si la requête porte un cookie de session Supabase (éventuellement découpé en morceaux). */
export function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

/**
 * Rafraîchit la session (jeton expiré → nouveau jeton) et propage les cookies
 * mis à jour à la requête ET à la réponse. Appelée par le proxy, seulement
 * lorsqu'un cookie de session est présent.
 */
export async function refreshSupabaseSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          // En-têtes anti-cache fournis par la bibliothèque : une réponse qui pose
          // des cookies de session ne doit jamais être mise en cache par un CDN.
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Vérifie la signature du jeton et le renouvelle si nécessaire. Ne pas
  // insérer de code entre la création du client et cet appel.
  await supabase.auth.getClaims();
  return response;
}
