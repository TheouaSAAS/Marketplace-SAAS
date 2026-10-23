/**
 * Contrôle de ce que renvoie l'IA, avant toute présentation à l'auteur :
 * champs autorisés seulement, valeurs nettoyées selon leur type, extrait
 * vérifié dans le texte source (sinon la suggestion est écartée), confiance
 * plafonnée pour une photo ou un PDF (jamais une source fiable sans relecture).
 */
import { ATTRIBUTE_SCHEMAS } from "@/modules/listings/domain/attributes";
import { normalize, type Suggestion, type SuggestionInput } from "./assistant";
import { cleanAttribute, draftSchema } from "./fields";

export interface RawAiSuggestion {
  field: string;
  value: unknown;
  confidence: number;
  excerpt: string;
}

/** Plafond de confiance selon la source : un document n'est jamais une preuve. */
export const CONFIDENCE_CAP: Record<SuggestionInput, number> = { texte: 0.9, pdf: 0.6, photo: 0.5 };

const DRAFT_FIELDS = ["title", "description", "price", "priceUnit", "negotiable", "contactPhone", "contactEmail"] as const;
type DraftField = (typeof DRAFT_FIELDS)[number];

/** Champs que l'IA peut proposer pour un schéma donné (description pour le prompt). */
export function allowedFields(schema: string | null): string[] {
  const attributes = schema ? Object.keys(ATTRIBUTE_SCHEMAS[schema] ?? {}) : [];
  return [...DRAFT_FIELDS, ...attributes.map((key) => `attributes.${key}`)];
}

function cleanValue(field: string, value: unknown, schema: string | null): unknown {
  if (field.startsWith("attributes.")) {
    const definition = schema ? ATTRIBUTE_SCHEMAS[schema]?.[field.slice("attributes.".length)] : undefined;
    return definition ? cleanAttribute(definition, value) : undefined;
  }
  if (!(DRAFT_FIELDS as readonly string[]).includes(field)) return undefined;
  const parsed = draftSchema.shape[field as DraftField].safeParse(value);
  if (!parsed.success) return undefined;
  const cleaned = parsed.data;
  return cleaned === null || cleaned === "" ? undefined : cleaned;
}

export function sanitizeAiSuggestions(
  raw: RawAiSuggestion[],
  { schema, input, source }: { schema: string | null; input: SuggestionInput; source: string | null },
): Suggestion[] {
  const allowed = new Set(allowedFields(schema));
  const haystack = source ? normalize(source) : null;
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    if (!allowed.has(item.field) || seen.has(item.field)) return [];
    const value = cleanValue(item.field, item.value, schema);
    if (value === undefined) return [];
    const excerpt = typeof item.excerpt === "string" ? item.excerpt.trim().slice(0, 300) : "";
    // Sur un texte, l'extrait doit figurer dans la source : sinon la valeur est peut-être inventée.
    if (haystack !== null && item.field !== "description" && (!excerpt || !haystack.includes(normalize(excerpt)))) return [];
    seen.add(item.field);
    const confidence = Math.max(0, Math.min(CONFIDENCE_CAP[input], Number.isFinite(item.confidence) ? item.confidence : 0));
    return [{ field: item.field, value, confidence: Math.round(confidence * 100) / 100, excerpt: excerpt || null, origin: "ia" as const, input }];
  });
}

/** Prix publics par million de jetons (entrée, sortie), en dollars. Modèle inconnu : le plus cher connu, par prudence. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-1": [10, 50],
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const [input, output] = PRICES[model] ?? [10, 50];
  return (inputTokens * input + outputTokens * output) / 1_000_000;
}
