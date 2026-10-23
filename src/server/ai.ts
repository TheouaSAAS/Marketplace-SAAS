import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/modules/publishing/domain/ai-output";
import { isFeatureEnabled } from "@/server/features";

/**
 * Appel à l'IA commun aux assistants FACULTATIFS (publication, page pro) :
 * disponibilité (drapeau, fournisseur, clé, budget), sortie structurée validée,
 * consommation enregistrée sans contenu. L'IA ne fait que proposer : aucun
 * appelant n'écrit sa réponse sans décision de la personne.
 */

const DEFAULT_MODEL = "claude-opus-5-5";
/** Modèles acceptant le repli automatique côté serveur en cas de refus. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

export type AiFeature = "publication" | "profil_pro";

export interface AiAvailability {
  available: boolean;
  /** Raison affichée quand l'assistant IA est indisponible. */
  reason: string | null;
}

/** L'assistant IA est-il utilisable maintenant ? (budget compris) */
export async function aiAvailability(): Promise<AiAvailability> {
  const env = getServerEnv();
  if (!isFeatureEnabled("ai_publishing")) return { available: false, reason: "L’assistant IA n’est pas activé sur cette plateforme." };
  if (env.AI_PROVIDER !== "anthropic") return { available: false, reason: "Fournisseur d’IA non pris en charge." };
  const admin = createAdminSupabaseClient();
  if (!admin) return { available: false, reason: "Suivi du budget de l’IA indisponible." };
  if (env.AI_MONTHLY_BUDGET_EUR !== undefined) {
    const { data, error } = await admin.rpc("ai_month_cost");
    if (error) return { available: false, reason: "Suivi du budget de l’IA indisponible." };
    // Coût estimé en dollars comparé au budget en euros : le plafond est atteint un peu plus tôt, par prudence.
    if (Number(data) >= env.AI_MONTHLY_BUDGET_EUR) return { available: false, reason: "Le budget mensuel de l’assistant IA est atteint." };
  }
  return { available: true, reason: null };
}

export type AiResult<T> = { ok: true; data: T } | { ok: false; message: string };

/** Un appel à sortie structurée (schéma Zod), avec repli en cas de refus et suivi de la consommation. */
export async function runStructured<S extends z.ZodType>({
  feature,
  userId,
  system,
  content,
  schema,
  maxTokens = 4000,
}: {
  feature: AiFeature;
  userId: string;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
  maxTokens?: number;
}): Promise<AiResult<z.infer<S>>> {
  const env = getServerEnv();
  const availability = await aiAvailability();
  if (!availability.available || !env.AI_API_KEY) return { ok: false, message: availability.reason ?? "Assistant IA indisponible." };
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: env.AI_API_KEY, timeout: 60_000, maxRetries: 1 });

  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, message: "L’assistant IA est très sollicité : réessayez dans une minute." };
    if (error instanceof Anthropic.BadRequestError) {
      logger.warn("Requête IA refusée", { module: "ia", feature, status: error.status });
      return { ok: false, message: "Ce document n’a pas pu être analysé (format ou taille)." };
    }
    if (error instanceof Anthropic.APIError) {
      logger.error("Assistant IA indisponible", { module: "ia", feature, status: error.status });
      return { ok: false, message: "Assistant IA momentanément indisponible." };
    }
    logger.error("Assistant IA injoignable", { module: "ia", feature, error });
    return { ok: false, message: "Assistant IA momentanément indisponible." };
  }

  const usedModel = response.model || model;
  const admin = createAdminSupabaseClient();
  await admin
    ?.from("ai_usage")
    .insert({
      user_id: userId,
      feature,
      model: usedModel.slice(0, 80),
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_usd: estimateCostUsd(usedModel, response.usage.input_tokens, response.usage.output_tokens),
    })
    .then(({ error }) => error && logger.error("Consommation IA non enregistrée", { module: "ia", code: error.code }));

  if (response.stop_reason === "refusal") return { ok: false, message: "L’assistant IA n’a pas pu traiter cette demande." };
  if (response.stop_reason === "max_tokens" || !response.parsed_output) return { ok: false, message: "Réponse de l’assistant IA incomplète : réessayez avec un document plus court." };
  return { ok: true, data: response.parsed_output as z.infer<S> };
}
