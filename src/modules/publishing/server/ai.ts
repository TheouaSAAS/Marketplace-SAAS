import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { ATTRIBUTE_SCHEMAS } from "@/modules/listings/domain/attributes";
import { runStructured } from "@/server/ai";
import type { Suggestion, SuggestionInput } from "../domain/assistant";
import { allowedFields, sanitizeAiSuggestions } from "../domain/ai-output";
import { PRICE_UNITS } from "../domain/fields";

export { aiAvailability } from "@/server/ai";

/**
 * Couche IA FACULTATIVE de la publication : extraction de champs depuis un
 * texte, une photo ou un PDF. Elle ne fait que proposer : aucune écriture dans
 * l'annonce, tout passe par la décision de l'auteur.
 */

export type AiInput =
  | { kind: "texte"; text: string }
  | { kind: "photo"; mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string }
  | { kind: "pdf"; base64: string };

export type AiResult = { ok: true; suggestions: Suggestion[]; notes: string[] } | { ok: false; message: string };

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
  const instruction = `Champs autorisés (n'utilise aucun autre nom de champ) :\n${fieldGuide(schema)}`;
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    input.kind === "texte"
      ? [{ type: "text", text: `${instruction}\n\nTexte de l'annonce :\n<document>\n${input.text}\n</document>` }]
      : input.kind === "photo"
        ? [{ type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64 } }, { type: "text", text: instruction }]
        : [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } }, { type: "text", text: instruction }];

  const result = await runStructured({ feature: "publication", userId, system: SYSTEM, content, schema: outputSchema });
  if (!result.ok) return result;
  const suggestions = sanitizeAiSuggestions(result.data.suggestions, {
    schema,
    input: input.kind as SuggestionInput,
    source: input.kind === "texte" ? input.text : null,
  });
  const notes = result.data.notes.map((note) => note.trim().slice(0, 200)).filter(Boolean).slice(0, 5);
  logger.info("Suggestions IA", { module: "publication", proposed: result.data.suggestions.length, kept: suggestions.length, allowed: allowedFields(schema).length });
  return { ok: true, suggestions, notes };
}
