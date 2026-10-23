import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { FeatureKey } from "@/config/feature-flags";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/modules/publishing/domain/ai-output";
import { isFeatureEnabled } from "@/server/features";

/**
 * Couche IA commune (niveau 23). Chaque usage a son drapeau ; toutes passent
 * par la même disponibilité (drapeau, fournisseur, clé, interrupteur général,
 * budget mensuel), le même suivi de consommation (volumes et coût, jamais de
 * contenu) et la même gestion d'erreurs. L'IA ne fait que proposer ou
 * répondre en citant : aucun appelant ne publie, ne refuse ni ne sanctionne
 * sur sa seule réponse.
 */

const DEFAULT_MODEL = "claude-opus-5-5";
/** Modèles acceptant le repli automatique côté serveur en cas de refus. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

export type AiFeature = "publication" | "profil_pro" | "assistant" | "recherche" | "moderation";

/** Drapeau qui active chaque usage. */
const FEATURE_FLAGS: Record<AiFeature, FeatureKey> = {
  publication: "ai_publishing",
  profil_pro: "ai_publishing",
  assistant: "ai_assistant",
  recherche: "ai_search",
  moderation: "ai_moderation",
};

export interface AiAvailability {
  available: boolean;
  /** Raison affichée quand l'IA est indisponible. */
  reason: string | null;
}

/** L'interrupteur général est-il actionné ? (prudence : illisible = coupé) */
export async function aiKillSwitchOn(): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  if (!admin) return true;
  const { data, error } = await admin.from("platform_settings").select("value").eq("key", "ai.kill_switch").maybeSingle();
  if (error) return true;
  const value = data?.value as { disabled?: unknown } | null | undefined;
  return value?.disabled === true;
}

/** L'usage d'IA est-il utilisable maintenant ? (budget compris) */
export async function aiAvailability(feature: AiFeature = "publication"): Promise<AiAvailability> {
  const env = getServerEnv();
  if (!isFeatureEnabled(FEATURE_FLAGS[feature])) return { available: false, reason: "L’assistant IA n’est pas activé sur cette plateforme." };
  if (env.AI_PROVIDER !== "anthropic") return { available: false, reason: "Fournisseur d’IA non pris en charge." };
  const admin = createAdminSupabaseClient();
  if (!admin) return { available: false, reason: "Suivi du budget de l’IA indisponible." };
  if (await aiKillSwitchOn()) return { available: false, reason: "L’IA est momentanément coupée par l’équipe de la plateforme." };
  if (env.AI_MONTHLY_BUDGET_EUR !== undefined) {
    const { data, error } = await admin.rpc("ai_month_cost");
    if (error) return { available: false, reason: "Suivi du budget de l’IA indisponible." };
    // Coût estimé en dollars comparé au budget en euros : le plafond est atteint un peu plus tôt, par prudence.
    if (Number(data) >= env.AI_MONTHLY_BUDGET_EUR) return { available: false, reason: "Le budget mensuel de l’assistant IA est atteint." };
  }
  return { available: true, reason: null };
}

export type AiResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function prepare(feature: AiFeature) {
  const env = getServerEnv();
  const availability = await aiAvailability(feature);
  if (!availability.available || !env.AI_API_KEY) return { ok: false as const, message: availability.reason ?? "Assistant IA indisponible." };
  const model = env.AI_MODEL || DEFAULT_MODEL;
  return {
    ok: true as const,
    model,
    client: new Anthropic({ apiKey: env.AI_API_KEY, timeout: 60_000, maxRetries: 1 }),
    fallback: FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {},
  };
}

function failure(error: unknown, feature: AiFeature): { ok: false; message: string } {
  if (error instanceof Anthropic.RateLimitError) return { ok: false, message: "L’assistant IA est très sollicité : réessayez dans une minute." };
  if (error instanceof Anthropic.BadRequestError) {
    logger.warn("Requête IA refusée", { module: "ia", feature, status: error.status });
    return { ok: false, message: "Cette demande n’a pas pu être analysée (format ou taille)." };
  }
  if (error instanceof Anthropic.APIError) {
    logger.error("Assistant IA indisponible", { module: "ia", feature, status: error.status });
    return { ok: false, message: "Assistant IA momentanément indisponible." };
  }
  logger.error("Assistant IA injoignable", { module: "ia", feature, error });
  return { ok: false, message: "Assistant IA momentanément indisponible." };
}

/** Consommation : usage, modèle, volumes et coût estimé. Ni question, ni réponse, ni document. */
async function recordUsage(feature: AiFeature, userId: string | null, model: string, usage: { input_tokens: number; output_tokens: number }) {
  await createAdminSupabaseClient()
    ?.from("ai_usage")
    .insert({
      user_id: userId,
      feature,
      model: model.slice(0, 80),
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: estimateCostUsd(model, usage.input_tokens, usage.output_tokens),
    })
    .then(({ error }) => error && logger.error("Consommation IA non enregistrée", { module: "ia", code: error.code }));
}

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
  userId: string | null;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
  maxTokens?: number;
}): Promise<AiResult<z.infer<S>>> {
  const ready = await prepare(feature);
  if (!ready.ok) return ready;
  let response;
  try {
    response = await ready.client.beta.messages.parse({
      model: ready.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      ...ready.fallback,
    });
  } catch (error) {
    return failure(error, feature);
  }
  await recordUsage(feature, userId, response.model || ready.model, response.usage);
  if (response.stop_reason === "refusal") return { ok: false, message: "L’assistant IA n’a pas pu traiter cette demande." };
  if (response.stop_reason === "max_tokens" || !response.parsed_output) return { ok: false, message: "Réponse de l’assistant IA incomplète : réessayez avec un document plus court." };
  return { ok: true, data: response.parsed_output as z.infer<S> };
}

/**
 * Une réponse rédigée à partir de documents, citations activées : chaque
 * passage de texte renvoyé porte les documents qu'il cite (sorties structurées
 * et citations sont incompatibles, d'où cet appel distinct).
 */
export async function runCited({
  feature,
  userId,
  system,
  documents,
  question,
  maxTokens = 2000,
}: {
  feature: AiFeature;
  userId: string | null;
  system: string;
  documents: Anthropic.Beta.BetaRequestDocumentBlock[];
  question: string;
  maxTokens?: number;
}): Promise<AiResult<Anthropic.Beta.BetaContentBlock[]>> {
  const ready = await prepare(feature);
  if (!ready.ok) return ready;
  let response;
  try {
    response = await ready.client.beta.messages.create({
      model: ready.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: [...documents, { type: "text", text: `Question : ${question}` }] }],
      output_config: { effort: "low" },
      ...ready.fallback,
    });
  } catch (error) {
    return failure(error, feature);
  }
  await recordUsage(feature, userId, response.model || ready.model, response.usage);
  if (response.stop_reason === "refusal") return { ok: false, message: "L’assistant IA n’a pas pu traiter cette demande." };
  return { ok: true, data: response.content };
}
