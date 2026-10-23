/**
 * Champs d'une annonce en cours de saisie et règles de validation. Un brouillon
 * peut être incomplet (enregistrement automatique) ; la soumission exige les
 * champs obligatoires. Les attributs suivent le registre de la catégorie.
 */
import { z } from "zod";
import { ATTRIBUTE_SCHEMAS, type AttributeDefinition } from "@/modules/listings/domain/attributes";

export const PRICE_UNITS = {
  total: "Prix total",
  par_mois: "Par mois",
  par_jour: "Par jour",
  par_nuit: "Par nuit",
  par_heure: "Par heure",
  a_partir_de: "À partir de",
} as const;
export type PriceUnit = keyof typeof PRICE_UNITS;

/** Ce que le public voit de la position (la position saisie reste privée). */
export const PUBLIC_PRECISIONS = {
  approximate: "Zone approximative (recommandé)",
  neighborhood: "Quartier seulement",
  exact: "Adresse exacte",
  hidden: "Ne pas afficher la position",
} as const;
export type PublicPrecision = keyof typeof PUBLIC_PRECISIONS;

/** Schémas d'annonces publiées par ce parcours ; l'emploi et les événements ont le leur. */
export const DEDICATED_FLOWS = { emploi: "publishJob", opportunite: "publishJob", appel_offres: "publishJob" } as const;

/** Schémas sans position obligatoire (même règle qu'en base). */
export const POSITIONLESS = ["emploi", "opportunite", "appel_offres", "formation"];

export const TITLE_MIN = 5;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 10000;

const PHONE = /^\+?[0-9 .-]{8,20}$/;
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

/** Brouillon tel qu'enregistré automatiquement : tout est facultatif, mais borné et typé. */
export const draftSchema = z.object({
  title: text(TITLE_MAX).default(""),
  description: text(DESCRIPTION_MAX).default(""),
  price: z.number().int().min(0).max(1_000_000_000_000).nullish().transform((value) => value ?? null),
  priceUnit: z.enum(Object.keys(PRICE_UNITS) as [PriceUnit, ...PriceUnit[]]).nullish().transform((value) => value ?? null),
  negotiable: z.boolean().default(false),
  neighborhoodId: z.uuid().nullish().transform((value) => value ?? null),
  lat: z.number().min(-90).max(90).nullish().transform((value) => value ?? null),
  lng: z.number().min(-180).max(180).nullish().transform((value) => value ?? null),
  exact: z.boolean().default(false),
  publicPrecision: z.enum(Object.keys(PUBLIC_PRECISIONS) as [PublicPrecision, ...PublicPrecision[]]).default("approximate"),
  attributes: z.record(z.string(), z.unknown()).default({}),
  contactName: optionalText(80),
  contactPhone: optionalText(30).refine((value) => value === null || PHONE.test(value), "Numéro de téléphone invalide."),
  contactWhatsapp: optionalText(30).refine((value) => value === null || PHONE.test(value), "Numéro WhatsApp invalide."),
  contactEmail: optionalText(200).refine((value) => value === null || z.email().safeParse(value).success, "Adresse e-mail invalide."),
  showPhone: z.boolean().default(false),
  showWhatsapp: z.boolean().default(false),
  showEmail: z.boolean().default(false),
});
export type ListingDraft = z.infer<typeof draftSchema>;

export const EMPTY_DRAFT: ListingDraft = draftSchema.parse({});

/** Valeur d'attribut nettoyée selon son type ; `undefined` si invalide ou vide. */
export function cleanAttribute(definition: AttributeDefinition, value: unknown): unknown {
  const { type } = definition;
  switch (type.kind) {
    case "text":
      return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 200) : undefined;
    case "integer": {
      const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
      return typeof number === "number" && Number.isInteger(number) && number >= 0 && number <= 1_000_000_000 ? number : undefined;
    }
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
    case "choice":
      return typeof value === "string" && Object.hasOwn(type.options, value) ? value : undefined;
    case "list": {
      if (!Array.isArray(value)) return undefined;
      const items = [...new Set(value.filter((item): item is string => typeof item === "string" && Object.hasOwn(type.options, item)))];
      return items.length ? items : undefined;
    }
  }
}

/** Attributs connus du schéma, nettoyés ; les clés inconnues sont écartées. */
export function cleanAttributes(schema: string | null, attributes: Record<string, unknown>): Record<string, unknown> {
  const definitions = schema ? ATTRIBUTE_SCHEMAS[schema] : undefined;
  if (!definitions) return {};
  return Object.fromEntries(
    Object.entries(definitions).flatMap(([key, definition]) => {
      const value = cleanAttribute(definition, attributes[key]);
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

export interface FieldProblem {
  field: string;
  message: string;
}

/** Champs obligatoires pour soumettre à la modération (les règles en base le garantissent aussi). */
export function submissionProblems(draft: ListingDraft, schema: string | null): FieldProblem[] {
  const problems: FieldProblem[] = [];
  if (draft.title.length < TITLE_MIN) problems.push({ field: "title", message: `Un titre d’au moins ${TITLE_MIN} caractères.` });
  if (draft.description.length < DESCRIPTION_MIN) problems.push({ field: "description", message: `Une description d’au moins ${DESCRIPTION_MIN} caractères.` });
  if (draft.priceUnit && draft.price === null) problems.push({ field: "price", message: "Indiquez le prix ou retirez l’unité." });
  if (!POSITIONLESS.includes(schema ?? "") && (draft.lat === null || draft.lng === null)) {
    problems.push({ field: "location", message: "Placez l’annonce sur la carte (le public ne voit que la précision choisie)." });
  }
  return problems;
}

/** Informations utiles mais facultatives : signalées, jamais inventées. */
export function missingInformation(draft: ListingDraft, schema: string | null, photoCount: number): string[] {
  const missing: string[] = [];
  if (photoCount === 0 && schema !== "service" && schema !== "formation") missing.push("Aucune photo : les annonces avec photos sont plus consultées.");
  if (draft.price === null && schema !== "service") missing.push("Pas de prix : indiquez-le, ou précisez « à débattre » dans la description.");
  if (draft.description.length > 0 && draft.description.length < 80) missing.push("Description courte : précisez l’état, les dimensions, les conditions.");
  if (!draft.neighborhoodId && !POSITIONLESS.includes(schema ?? "")) missing.push("Quartier non précisé.");
  const definitions = schema ? ATTRIBUTE_SCHEMAS[schema] : undefined;
  if (definitions) {
    const empty = Object.entries(definitions).filter(([key]) => draft.attributes[key] === undefined).map(([, definition]) => definition.label.toLowerCase());
    if (empty.length) missing.push(`Caractéristiques non renseignées : ${empty.join(", ")}.`);
  }
  return missing;
}
