import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ATTRIBUTE_SCHEMAS } from "@/modules/listings/domain/attributes";
import { isFeatureEnabled } from "@/server/features";
import type { Suggestion, SuggestionInput } from "../domain/assistant";
import { allowedFields, estimateCostUsd, sanitizeAiSuggestions } from "../domain/ai-output";
import { PRICE_UNITS } from "../domain/fields";

/**
 * Couche IA FACULTATIVE de la publication : extraction de champs depuis un
 * texte, une photo ou un PDF. Elle ne fait que proposer : aucune écriture dans
 * l'annonce, tout passe par la décision de l'auteur. Désactivée si le drapeau
 * `ai_publishing`, le fournisseur, la clé ou la clé secrète (budget) manquent,
 * ou si le budget du mois est atteint.
 */

const DEFAULT_MODEL = "claude-opus-5-5";
/** Modèles acceptant le repli automatique côté serveur en cas de refus. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

export type AiInput =
  | { kind: "texte"; text: string }
  | { kind: "photo"; mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string }
  | { kind: "pdf"; base64: string };

export type AiResult = { ok: true; suggestions: Suggestion[]; notes: string[] } | { ok: false; message: string };

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

const outputSchema = z.object({
  suggestions: z.array(
    z.object({
      field: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      confidence: z.number(),
      excerpt: z.string(),
    }),
  ),
  notes: z.array(z.string()),
});

function fieldGuide(schema: string | null): string {
  const lines = [
    "- title (texte, 5 à 120 caractères) : titre court et factuel",
    "- description (texte) : description reprenant les informations présentes",
    "- price (entier, en francs CFA)",
    `- priceUnit (une valeur parmi : ${Object.keys(PRICE_UNITS).join(", ")})`,
    "- negotiable (booléen) : seulement si le document dit « à débattre » ou « négociable »",
    "- contactPhone (texte), contactEmail (texte)",
  ];
  const definitions = schema ? ATTRIBUTE_SCHEMAS[schema] : undefined;
  for (const [key, definition] of Object.entries(definitions ?? {})) {
    const { type } = definition;
    const kind =
      type.kind === "choice" || type.kind === "list"
        ? `${type.kind === "list" ? "liste de valeurs" : "une valeur"} parmi : ${Object.keys(type.options).join(", ")}`
        : { text: "texte", integer: "entier", boolean: "booléen", date: "date AAAA-MM-JJ" }[type.kind];
    lines.push(`- attributes.${key} (${kind}) : ${definition.label}`);
  }
  return lines.join("\n");
}

const SYSTEM = `Tu aides une personne à remplir une petite annonce sur une plateforme locale de San Pedro (Côte d'Ivoire).
Tu extrais uniquement les informations EXPLICITEMENT présentes dans le document fourni. Tu ne devines rien, tu ne complètes rien, tu n'inventes aucun prix, adresse, numéro, caractéristique ou état.
Pour chaque information trouvée, renvoie le champ, la valeur, ta confiance (0 à 1) et l'extrait exact du document qui la justifie (citation mot pour mot ; pour une photo, décris brièvement ce qui est visible).
Une photo ne prouve ni l'état, ni la marque, ni le prix : reste prudent et baisse ta confiance.
Dans "notes", signale en une phrase chacune les problèmes utiles à l'auteur (photo floue, sombre, ne montrant pas l'objet, texte illisible, informations contradictoires). Pas de notes si tout va bien.
Réponds en français.`;

/** Extraction par l'IA ; les suggestions sont ensuite contrôlées (champs, types, extraits) avant affichage. */
export async function extractWithAi(input: AiInput, schema: string | null, userId: string): Promise<AiResult> {
  const env = getServerEnv();
  const availability = await aiAvailability();
  if (!availability.available || !env.AI_API_KEY) return { ok: false, message: availability.reason ?? "Assistant IA indisponible." };
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: env.AI_API_KEY, timeout: 60_000, maxRetries: 1 });

  const instruction = `Champs autorisés (n'utilise aucun autre nom de champ) :\n${fieldGuide(schema)}`;
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    input.kind === "texte"
      ? [{ type: "text", text: `${instruction}\n\nTexte de l'annonce :\n<document>\n${input.text}\n</document>` }]
      : input.kind === "photo"
        ? [{ type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64 } }, { type: "text", text: instruction }]
        : [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } }, { type: "text", text: instruction }];

  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { effort: "low", format: betaZodOutputFormat(outputSchema) },
      ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, message: "L’assistant IA est très sollicité : réessayez dans une minute." };
    if (error instanceof Anthropic.BadRequestError) {
      logger.warn("Requête IA refusée", { module: "publication", status: error.status });
      return { ok: false, message: "Ce document n’a pas pu être analysé (format ou taille)." };
    }
    if (error instanceof Anthropic.APIError) {
      logger.error("Assistant IA indisponible", { module: "publication", status: error.status });
      return { ok: false, message: "Assistant IA momentanément indisponible." };
    }
    logger.error("Assistant IA injoignable", { module: "publication", error });
    return { ok: false, message: "Assistant IA momentanément indisponible." };
  }

  const usedModel = response.model || model;
  const admin = createAdminSupabaseClient();
  await admin
    ?.from("ai_usage")
    .insert({
      user_id: userId,
      feature: "publication",
      model: usedModel.slice(0, 80),
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_usd: estimateCostUsd(usedModel, response.usage.input_tokens, response.usage.output_tokens),
    })
    .then(({ error }) => error && logger.error("Consommation IA non enregistrée", { module: "publication", code: error.code }));

  if (response.stop_reason === "refusal") return { ok: false, message: "L’assistant IA n’a pas pu traiter ce document." };
  if (response.stop_reason === "max_tokens" || !response.parsed_output) return { ok: false, message: "Réponse de l’assistant IA incomplète : réessayez avec un document plus court." };

  const suggestions = sanitizeAiSuggestions(response.parsed_output.suggestions, {
    schema,
    input: input.kind as SuggestionInput,
    source: input.kind === "texte" ? input.text : null,
  });
  const notes = response.parsed_output.notes.map((note) => note.trim().slice(0, 200)).filter(Boolean).slice(0, 5);
  logger.info("Suggestions IA", { module: "publication", proposed: response.parsed_output.suggestions.length, kept: suggestions.length, allowed: allowedFields(schema).length });
  return { ok: true, suggestions, notes };
}
