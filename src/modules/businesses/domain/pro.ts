/**
 * Page professionnelle : badges (définitions publiques), complétude, champs du
 * formulaire et rôles d'équipe. « Vérifié » ne se déclare jamais : il vient de
 * l'équipe locale avec une source ; « profil complété » ne dit rien de
 * l'exactitude, seulement que les rubriques sont remplies.
 */
import { z } from "zod";
import { WEEK_DAYS, DAY_LABELS, type OpeningHours, type WeekDay } from "@/modules/shops/domain/hours";

export const PRO_BADGES = {
  verified: {
    label: "Vérifié",
    tone: "success",
    definition: "L’équipe locale a contrôlé l’existence et l’activité du professionnel avec une source (document, registre, visite), à une date affichée.",
  },
  pending: {
    label: "En cours de validation",
    tone: "info",
    definition: "Le professionnel a demandé la vérification de sa page ; l’équipe locale ne l’a pas encore contrôlée. Ce n’est pas une vérification.",
  },
  complete: {
    label: "Profil complété",
    tone: "brand",
    definition: "Le professionnel a rempli présentation, prestations, zone desservie, contact, horaires et photos. Les informations sont déclarées, pas vérifiées.",
  },
  sponsored: {
    label: "Sponsorisé",
    tone: "accent",
    definition: "Mise en avant payée par le professionnel. Elle n’influence ni la vérification ni les avis.",
  },
} as const;
export type ProBadge = keyof typeof PRO_BADGES;

export interface CompletenessInput {
  description: string | null;
  category: unknown;
  services: string[];
  service_area: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  opening_hours: unknown;
  photoCount: number;
}

export const COMPLETENESS_RULES: { key: string; label: string; ok: (input: CompletenessInput) => boolean }[] = [
  { key: "presentation", label: "Une présentation d’au moins 80 caractères", ok: (input) => (input.description ?? "").trim().length >= 80 },
  { key: "category", label: "Une catégorie", ok: (input) => Boolean(input.category) },
  { key: "services", label: "Au moins une prestation", ok: (input) => input.services.length > 0 },
  { key: "zone", label: "La zone desservie", ok: (input) => Boolean(input.service_area?.trim()) },
  { key: "contact", label: "Un moyen de contact (téléphone, WhatsApp, e-mail ou site)", ok: (input) => Boolean(input.phone || input.whatsapp || input.email || input.website) },
  {
    key: "hours",
    label: "Des horaires",
    ok: (input) => typeof input.opening_hours === "object" && input.opening_hours !== null && Object.keys(input.opening_hours).length > 0,
  },
  { key: "photos", label: "Au moins une photo", ok: (input) => input.photoCount > 0 },
];

export function completeness(input: CompletenessInput): { complete: boolean; done: number; total: number; missing: string[] } {
  const missing = COMPLETENESS_RULES.filter((rule) => !rule.ok(input)).map((rule) => rule.label);
  return { complete: missing.length === 0, done: COMPLETENESS_RULES.length - missing.length, total: COMPLETENESS_RULES.length, missing };
}

/** Badges d'une page, dans l'ordre d'affichage ; « vérifié » prime sur « en cours de validation ». */
export function proBadges(input: { verified: boolean; verificationPending: boolean; complete: boolean; sponsored: boolean }): ProBadge[] {
  const badges: ProBadge[] = [];
  if (input.verified) badges.push("verified");
  else if (input.verificationPending) badges.push("pending");
  if (input.complete) badges.push("complete");
  if (input.sponsored) badges.push("sponsored");
  return badges;
}

// -----------------------------------------------------------------------------
// Équipe
// -----------------------------------------------------------------------------
export const TEAM_ROLES = {
  owner: { label: "Propriétaire", rights: "Tous les droits, y compris nommer d’autres propriétaires et supprimer l’équipe." },
  admin: { label: "Administrateur", rights: "Modifie la page, publie au nom de l’équipe, invite et retire des membres." },
  editor: { label: "Éditeur", rights: "Modifie la page, ses photos et répond aux avis ; publie des annonces au nom de l’équipe." },
  viewer: { label: "Lecteur", rights: "Consulte l’espace de gestion sans rien modifier." },
} as const;
export type TeamRole = keyof typeof TEAM_ROLES;
export const ROLE_RANK: Record<TeamRole, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };

export const ORGANIZATION_KINDS = {
  artisan: "Artisan",
  commerce: "Commerce",
  entreprise: "Entreprise",
  agence: "Agence",
  operateur_touristique: "Opérateur touristique",
  association: "Association",
  institution: "Institution",
  autre: "Autre",
} as const;
export type OrganizationKind = keyof typeof ORGANIZATION_KINDS;

// -----------------------------------------------------------------------------
// Formulaire de la page
// -----------------------------------------------------------------------------
const https = z
  .string()
  .trim()
  .max(300)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Adresse https:// complète attendue.");

/** Champ facultatif : vide → null, sinon validé par le schéma donné. */
const optional = <S extends z.ZodType<string, string>>(schema: S) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() ? value.trim() : null), schema.nullable());

const PHONE = /^\+?[0-9 .-]{8,20}$/;

export const faqSchema = z
  .array(z.object({ question: z.string().trim().min(5, "Question trop courte.").max(200), answer: z.string().trim().min(5, "Réponse trop courte.").max(1000) }))
  .max(10, "Dix questions au plus.");
export const linksSchema = z.array(z.object({ label: z.string().trim().min(2).max(40), url: https })).max(6, "Six liens au plus.");

export type FaqItem = z.infer<typeof faqSchema>[number];
export type ProLink = z.infer<typeof linksSchema>[number];

/** Liste saisie une par ligne (ou séparée par des virgules), sans doublon. */
export function splitList(raw: string, max: number, itemMax: number): string[] {
  return [...new Set(raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))].slice(0, max).map((item) => item.slice(0, itemMax));
}

/** Horaires saisis jour par jour : vide = non renseigné, « fermé » = fermé, sinon « 08:00-12:00, 14:00-18:00 ». */
export function parseDayHours(raw: string): { ok: true; slots: [string, string][] | undefined } | { ok: false; message: string } {
  const text = raw.trim().toLowerCase();
  if (!text) return { ok: true, slots: undefined };
  if (/^ferm[ée]e?$/.test(text)) return { ok: true, slots: [] };
  const slots: [string, string][] = [];
  for (const part of text.split(/[,;]/).map((item) => item.trim()).filter(Boolean)) {
    const match = /^(\d{1,2})[:h](\d{2})?\s*[-–à]\s*(\d{1,2})[:h](\d{2})?$/.exec(part.replace(/\s+/g, " "));
    if (!match) return { ok: false, message: `« ${part} » : écrivez par exemple 08:00-12:00.` };
    const start = `${match[1]!.padStart(2, "0")}:${match[2] ?? "00"}`;
    const end = `${match[3]!.padStart(2, "0")}:${match[4] ?? "00"}`;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(end) || end <= start) {
      return { ok: false, message: `« ${part} » : horaire impossible.` };
    }
    slots.push([start, end]);
  }
  if (slots.length > 4) return { ok: false, message: "Quatre plages au plus par jour." };
  return { ok: true, slots };
}

export function formatDayHours(slots: [string, string][] | undefined): string {
  if (slots === undefined) return "";
  if (slots.length === 0) return "fermé";
  return slots.map(([start, end]) => `${start}-${end}`).join(", ");
}

export function parseWeekHours(values: Partial<Record<WeekDay, string>>): { ok: true; hours: OpeningHours } | { ok: false; errors: Record<string, string> } {
  const hours: OpeningHours = {};
  const errors: Record<string, string> = {};
  for (const day of WEEK_DAYS) {
    const parsed = parseDayHours(values[day] ?? "");
    if (!parsed.ok) errors[`horaires_${day}`] = `${DAY_LABELS[day]} : ${parsed.message}`;
    else if (parsed.slots !== undefined) hours[day] = parsed.slots;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, hours };
}

export const pageSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(120),
  categoryId: z.uuid("Choisissez une catégorie."),
  neighborhoodId: z.uuid().nullable(),
  description: z.string().trim().max(3000).transform((value) => value || null),
  services: z.array(z.string()).max(30),
  serviceArea: optional(z.string().max(200)),
  availabilityNote: optional(z.string().max(200)),
  acceptsQuotes: z.boolean(),
  phone: optional(z.string().regex(PHONE, "Numéro invalide.")),
  whatsapp: optional(z.string().regex(PHONE, "Numéro invalide.")),
  email: optional(z.email("Adresse e-mail invalide.")),
  website: optional(https),
  links: linksSchema,
  faq: faqSchema,
});
export type PageInput = z.infer<typeof pageSchema>;
