import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Client à clé SECRÈTE : contourne les règles RLS.
 * Réservé aux opérations qu'aucun utilisateur ne doit pouvoir déclencher
 * lui-même : confirmation de paiement par webhook, activation d'abonnement,
 * tâches planifiées. Ne jamais l'utiliser pour lire des données à afficher
 * sans avoir vérifié les droits de l'utilisateur au préalable.
 */
export function createAdminSupabaseClient(): SupabaseClient<Database> | null {
  const secret = getServerEnv().SUPABASE_SECRET_KEY;
  if (!isSupabaseConfigured() || !secret) return null;
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
