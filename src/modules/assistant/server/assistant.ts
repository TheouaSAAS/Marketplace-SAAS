import "server-only";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { aiAvailability, runCited } from "@/server/ai";
import { consumeRateLimit } from "@/server/rate-limit";
import { ASSISTANT_SYSTEM, buildDocuments, interpretAnswer, type AssistantResult, type Passage } from "../domain/rag";

/**
 * « Demandez à San Pedro » : recherche des passages VÉRIFIÉS (sans IA), puis,
 * si l'IA est disponible, réponse rédigée qui cite ces passages. Sans IA, les
 * passages trouvés sont présentés avec leurs sources : le service reste utile.
 * La question n'est ni enregistrée ni journalisée.
 */

const rowSchema = z.object({
  chunk_id: z.uuid(),
  entity_type: z.string(),
  title: z.string(),
  url_path: z.string().nullable(),
  content: z.string(),
  verified_at: z.string().nullable(),
  source_title: z.string().nullable(),
});

export async function findPassages(query: string, limit = 6): Promise<Passage[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("search_knowledge", { p_query: query, p_limit: limit });
  if (error) throw new Error(`Base de connaissances : ${error.code}`);
  return z
    .array(rowSchema)
    .parse(data)
    .map((row) => ({
      chunkId: row.chunk_id,
      entityType: row.entity_type,
      title: row.title,
      url: row.url_path,
      content: row.content,
      verifiedAt: row.verified_at,
      sourceTitle: row.source_title,
    }));
}

/**
 * `context` (facultatif) oriente seulement la recherche des passages, par
 * exemple les priorités d'un plan d'installation ; il n'est jamais conservé.
 */
export async function askSanPedro(question: string, { userId, context }: { userId: string | null; context?: string }): Promise<AssistantResult> {
  const passages = await findPassages(context ? `${question} ${context}` : question);
  // Aucune donnée vérifiée : refus honnête, sans même solliciter le modèle.
  if (passages.length === 0) return { kind: "no_info", sources: [] };

  const availability = await aiAvailability("assistant");
  if (!availability.available) return { kind: "sources_only", sources: passages, reason: availability.reason ?? "Réponses rédigées indisponibles." };
  if (!(await consumeRateLimit("aiAssistant", userId ?? undefined))) {
    return { kind: "sources_only", sources: passages, reason: "Vous avez posé beaucoup de questions : voici les passages vérifiés trouvés. Réessayez dans une heure pour une réponse rédigée." };
  }

  const result = await runCited({ feature: "assistant", userId, system: ASSISTANT_SYSTEM, documents: buildDocuments(passages), question });
  if (!result.ok) {
    logger.warn("Réponse rédigée indisponible", { module: "assistant" });
    return { kind: "sources_only", sources: passages, reason: result.message };
  }
  return interpretAnswer(result.data, passages);
}
