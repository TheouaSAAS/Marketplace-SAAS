import "server-only";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SearchType } from "../domain/params";

/**
 * Compte une recherche dans les statistiques agrégées (jour, ville, type,
 * texte normalisé ; chiffres et e-mails masqués en base). Aucune donnée de
 * personne : ni compte, ni adresse IP, ni position. Appelé après la réponse
 * (`after`) : une panne des statistiques ne ralentit ni ne casse la recherche.
 */
export async function recordSearch(input: { cityId: string; type: SearchType | "apercu"; query: string; results: number }): Promise<void> {
  if (!input.query) return;
  const supabase = createAdminSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("record_search", {
    p_city: input.cityId,
    p_type: input.type,
    p_query: input.query,
    p_results: input.results,
  });
  if (error) logger.warn("Statistique de recherche non enregistrée", { module: "recherche", code: error.code });
}
