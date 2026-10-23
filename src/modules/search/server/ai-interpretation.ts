import "server-only";
import { sanitizeQuestion } from "@/modules/assistant/domain/rag";
import { aiAvailability, runStructured } from "@/server/ai";
import { getSessionUser } from "@/server/auth";
import { consumeRateLimit } from "@/server/rate-limit";
import { aiFiltersSchema, aiSearchSystem, toInterpretation, type AiSearchContext } from "../domain/ai-interpretation";
import type { Interpretation } from "../domain/natural-language";

/** Phrases assez longues pour justifier un appel (les mots isolés restent des mots-clés). */
export const AI_MIN_WORDS = 3;

/**
 * Interprétation par l'IA, en dernier recours : indisponible, limitée ou en
 * échec, elle s'efface sans erreur et la recherche classique s'applique.
 */
export async function interpretWithAi(query: string, context: AiSearchContext): Promise<Interpretation | null> {
  if (query.trim().split(/\s+/).length < AI_MIN_WORDS) return null;
  if (!(await aiAvailability("recherche")).available) return null;
  if (!(await consumeRateLimit("aiSearch"))) return null;
  const user = await getSessionUser();
  const result = await runStructured({
    feature: "recherche",
    userId: user?.id ?? null,
    system: aiSearchSystem(context),
    content: [{ type: "text", text: `Demande : ${sanitizeQuestion(query)}` }],
    schema: aiFiltersSchema,
    maxTokens: 1000,
  });
  return result.ok ? toInterpretation(result.data, context, query) : null;
}
