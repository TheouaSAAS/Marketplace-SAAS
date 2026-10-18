import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Client ANONYME, sans cookies ni session : il ne lit que ce que les règles RLS
 * autorisent à tout visiteur (contenus publiés, villes, catégories).
 * Comme il ne dépend pas de la requête, il peut être utilisé dans des fonctions
 * `"use cache"` et alimenter le rendu statique des pages publiques.
 *
 * Retourne null si Supabase n'est pas configuré : l'appelant affiche alors un
 * état dégradé explicite au lieu de planter.
 *
 * Attention : certaines colonnes (position exacte, coordonnées de contact) ne
 * sont pas lisibles par l'API publique. Toujours lister les colonnes voulues,
 * jamais `select("*")` sur `listings` ou `business_profiles`.
 */
export function createPublicSupabaseClient(): TypedSupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
