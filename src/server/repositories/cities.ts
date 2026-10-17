import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import type { CitySummary } from "@/domain/city";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const CITIES_CACHE_TAG = "cities";

const cityRowSchema = z.object({ id: z.uuid(), slug: z.string(), name: z.string() });

/**
 * Villes actives, ville par défaut en premier. Mis en cache (données publiques
 * qui changent rarement) ; l'administration invalide le tag `cities` après
 * chaque modification.
 *
 * Retourne null si Supabase n'est pas configuré. Lève une erreur si la base
 * répond mal : l'erreur n'est pas mise en cache et l'appelant décide du repli.
 */
export async function listActiveCities(): Promise<CitySummary[] | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CITIES_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("cities")
    .select("id, slug, name")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("name");

  if (error) throw new Error(`Lecture des villes impossible : ${error.message}`);
  return z.array(cityRowSchema).parse(data);
}
