/**
 * Critères de l'agenda dans l'adresse (forme canonique) : période, prix,
 * catégorie, quartier, vue (liste ou calendrier) et mois affiché.
 */
import { WHEN, type SearchWhen } from "@/modules/search/domain/params";

export const EVENT_WHEN = { aujourdhui: WHEN.aujourdhui, weekend: WHEN.weekend, semaine: WHEN.semaine, mois: WHEN.mois } as const;
export type EventWhen = keyof typeof EVENT_WHEN & SearchWhen;

export const EVENT_PRICES = { gratuit: "Gratuit", payant: "Payant" } as const;
export type EventPrice = keyof typeof EVENT_PRICES;

export interface EventFilters {
  q: string;
  quand: EventWhen | null;
  prix: EventPrice | null;
  categorie: string | null;
  quartier: string | null;
  vue: "liste" | "calendrier";
  mois: string | null;
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const slug = (value: string | undefined) => (value && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null);

export function parseEventFilters(raw: Raw): EventFilters {
  const quand = first(raw.quand);
  const prix = first(raw.prix);
  const mois = first(raw.mois);
  const page = first(raw.page);
  const vue = first(raw.vue) === "calendrier" ? "calendrier" : "liste";
  return {
    q: (first(raw.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    quand: quand && Object.hasOwn(EVENT_WHEN, quand) ? (quand as EventWhen) : null,
    prix: prix && Object.hasOwn(EVENT_PRICES, prix) ? (prix as EventPrice) : null,
    categorie: slug(first(raw.categorie)),
    quartier: slug(first(raw.quartier)),
    vue,
    // Le mois n'a de sens qu'en vue calendrier.
    mois: vue === "calendrier" && mois && /^20\d\d-(0[1-9]|1[0-2])$/.test(mois) ? mois : null,
    page: page && /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= 1000 ? Number(page) : 1,
  };
}

export function eventQuery(filters: EventFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.quand) query.set("quand", filters.quand);
  if (filters.prix) query.set("prix", filters.prix);
  if (filters.categorie) query.set("categorie", filters.categorie);
  if (filters.quartier) query.set("quartier", filters.quartier);
  if (filters.vue === "calendrier") query.set("vue", "calendrier");
  if (filters.mois) query.set("mois", filters.mois);
  if (filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
}
