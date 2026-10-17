import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Client ANONYME, sans cookies ni session : il ne lit que ce que les règles RLS
 * autorisent à tout visiteur (contenus publiés, villes, catégories).
 * Comme il ne dépend pas de la requête, il peut être utilisé dans des fonctions
 * `"use cache"` et alimenter le rendu statique des pages publiques.
 *
 * Retourne null si Supabase n'est pas configuré : l'appelant affiche alors un
 * état dégradé explicite au lieu de planter.
 */
export function createPublicSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
