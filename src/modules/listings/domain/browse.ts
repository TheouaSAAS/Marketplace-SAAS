import type { AttributeDefinition } from "./attributes";

/**
 * « Toutes les annonces » : paramètres de l'adresse (partageable, conservée au
 * retour depuis une fiche), revalidés ici. Les filtres de caractéristiques ne
 * s'appliquent que s'ils appartiennent à la catégorie choisie.
 */

export const BROWSE_SORTS = {
  recent: "Les plus récentes",
  prix_asc: "Prix croissant",
  prix_desc: "Prix décroissant",
  pertinence: "Pertinence",
} as const;
export type BrowseSort = keyof typeof BROWSE_SORTS;

export const BROWSE_PAGE_SIZE = 24;
const MAX_PRICE = 1_000_000_000_000;

type Raw = Record<string, string | string[] | undefined>;

export interface BrowseParams {
  q: string;
  ville: string | null;
  quartier: string | null;
  categorie: string | null;
  prixMin: number | null;
  prixMax: number | null;
  dispo: boolean;
  tri: BrowseSort | null;
  page: number;
  /** Caractéristiques : `etat=bon`, `marque=toyota`, `annee_min=2015`, `kilometrage_max=100000`… */
  attributes: Record<string, string>;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
const slug = (value: string) => (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null);
const amount = (value: string, max: number) => {
  const digits = value.replace(/[\s.]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const parsed = Number(digits);
  return parsed > 0 && parsed <= max ? parsed : null;
};

const RESERVED = new Set(["q", "ville", "quartier", "categorie", "prix_min", "prix_max", "dispo", "tri", "page"]);

export function parseBrowseParams(raw: Raw): BrowseParams {
  const tri = first(raw.tri);
  const page = Number(first(raw.page));
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (RESERVED.has(key) || !/^[a-z][a-z0-9_]{0,40}$/.test(key)) continue;
    const text = first(value).replace(/\s+/g, " ").slice(0, 60);
    if (text) attributes[key] = text;
  }
  return {
    q: first(raw.q).replace(/\s+/g, " ").slice(0, 120),
    ville: slug(first(raw.ville)),
    quartier: slug(first(raw.quartier)),
    categorie: slug(first(raw.categorie)),
    prixMin: amount(first(raw.prix_min), MAX_PRICE),
    prixMax: amount(first(raw.prix_max), MAX_PRICE),
    dispo: first(raw.dispo) === "1",
    tri: Object.hasOwn(BROWSE_SORTS, tri) ? (tri as BrowseSort) : null,
    page: Number.isInteger(page) && page > 1 && page <= 500 ? page : 1,
    attributes,
  };
}

/** Adresse canonique : paramètres utiles seulement, dans un ordre fixe. */
export function browseQuery(params: BrowseParams, overrides: Partial<BrowseParams> = {}): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  if (merged.q) search.set("q", merged.q);
  if (merged.categorie) search.set("categorie", merged.categorie);
  if (merged.ville) search.set("ville", merged.ville);
  if (merged.quartier) search.set("quartier", merged.quartier);
  if (merged.prixMin !== null) search.set("prix_min", String(merged.prixMin));
  if (merged.prixMax !== null) search.set("prix_max", String(merged.prixMax));
  if (merged.dispo) search.set("dispo", "1");
  for (const key of Object.keys(merged.attributes).sort()) search.set(key, merged.attributes[key]!);
  if (merged.tri && merged.tri !== "recent") search.set("tri", merged.tri);
  if (merged.page > 1) search.set("page", String(merged.page));
  return search.toString();
}

export interface AttributeCriteria {
  eq: Record<string, string | boolean> | null;
  text: Record<string, string> | null;
  min: Record<string, number> | null;
  max: Record<string, number> | null;
}

const orNull = <T extends object>(value: T) => (Object.keys(value).length ? value : null);

/**
 * Critères de recherche à partir des caractéristiques demandées, limités aux
 * filtres de la catégorie (une valeur inconnue ou hors de la liste est ignorée).
 */
export function attributeCriteria(attributes: Record<string, string>, filters: readonly [string, AttributeDefinition][]): AttributeCriteria {
  const eq: Record<string, string | boolean> = {};
  const text: Record<string, string> = {};
  const min: Record<string, number> = {};
  const max: Record<string, number> = {};
  for (const [key, definition] of filters) {
    const { type } = definition;
    if (type.kind === "choice") {
      const value = attributes[key];
      if (value && Object.hasOwn(type.options, value)) eq[key] = value;
    } else if (type.kind === "boolean") {
      if (attributes[key] === "1") eq[key] = true;
    } else if (type.kind === "text") {
      const value = attributes[key]?.trim();
      if (value && value.length >= 2) text[key] = value;
    } else if (type.kind === "integer") {
      const low = amount(attributes[`${key}_min`] ?? "", MAX_PRICE);
      const high = amount(attributes[`${key}_max`] ?? "", MAX_PRICE);
      if (low !== null) min[key] = low;
      if (high !== null) max[key] = high;
    }
  }
  return { eq: orNull(eq), text: orNull(text), min: orNull(min), max: orNull(max) };
}

/** Caractéristiques réellement appliquées, pour les conserver dans l'adresse. */
export function appliedAttributes(criteria: AttributeCriteria): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(criteria.eq ?? {})) result[key] = value === true ? "1" : String(value);
  for (const [key, value] of Object.entries(criteria.text ?? {})) result[key] = value;
  for (const [key, value] of Object.entries(criteria.min ?? {})) result[`${key}_min`] = String(value);
  for (const [key, value] of Object.entries(criteria.max ?? {})) result[`${key}_max`] = String(value);
  return result;
}
