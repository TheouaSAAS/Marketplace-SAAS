/**
 * Paramètres de la recherche, tels qu'ils apparaissent dans l'adresse
 * (partageable, rechargeable). La lecture est tolérante : une valeur invalide
 * est ignorée, jamais une erreur. Un filtre qui ne s'applique pas au type
 * affiché est retiré, pour que l'adresse décrive exactement ce qui est montré.
 */

export const SEARCH_TYPES = {
  annonces: { label: "Annonces", singular: "Annonce", contentType: "listing" },
  lieux: { label: "Lieux et commerces", singular: "Lieu", contentType: "place" },
  professionnels: { label: "Professionnels", singular: "Professionnel", contentType: "business" },
  evenements: { label: "Événements", singular: "Événement", contentType: "event" },
  guide: { label: "Guide pratique", singular: "Guide pratique", contentType: null },
} as const;

export type SearchType = keyof typeof SEARCH_TYPES;
export const SEARCH_TYPE_KEYS = Object.keys(SEARCH_TYPES) as SearchType[];

export const SORTS = {
  pertinence: "Pertinence",
  recent: "Les plus récents",
  prix_asc: "Prix croissant",
  prix_desc: "Prix décroissant",
  date: "Date la plus proche",
  proximite: "Distance",
} as const;

export type SearchSort = keyof typeof SORTS;

/** Tris proposés par type, le premier étant celui par défaut sans mot-clé. */
export const SORTS_BY_TYPE: Record<SearchType, readonly SearchSort[]> = {
  annonces: ["recent", "pertinence", "prix_asc", "prix_desc", "proximite"],
  lieux: ["pertinence", "recent", "proximite"],
  professionnels: ["pertinence", "recent", "proximite"],
  evenements: ["date", "pertinence", "proximite"],
  guide: ["pertinence", "recent"],
};

export const WHEN = {
  aujourdhui: "Aujourd’hui",
  demain: "Demain",
  weekend: "Ce week-end",
  semaine: "Dans les 7 jours",
  mois: "Dans les 30 jours",
} as const;

export type SearchWhen = keyof typeof WHEN;

export const SELLERS = { particulier: "Particulier", professionnel: "Professionnel" } as const;
export type SearchSeller = keyof typeof SELLERS;

export const PAGE_SIZE = 12;
export const MAX_QUERY_LENGTH = 120;
const MAX_PRICE = 1_000_000_000_000;

export interface SearchParams {
  q: string;
  /** null : aperçu de tous les types. */
  type: SearchType | null;
  categorie: string | null;
  quartier: string | null;
  verifie: boolean;
  prixMin: number | null;
  prixMax: number | null;
  dispo: boolean;
  annonceur: SearchSeller | null;
  quand: SearchWhen | null;
  /** Rayon en kilomètres (n'agit qu'avec une position autorisée). */
  rayon: number | null;
  tri: SearchSort | null;
  page: number;
  /** Désactive l'interprétation de la phrase (recherche du texte exact). */
  brut: boolean;
}

export const EMPTY_SEARCH: SearchParams = {
  q: "",
  type: null,
  categorie: null,
  quartier: null,
  verifie: false,
  prixMin: null,
  prixMax: null,
  dispo: false,
  annonceur: null,
  quand: null,
  rayon: null,
  tri: null,
  page: 1,
  brut: false,
};

type Filter = "categorie" | "prix" | "dispo" | "annonceur" | "quand";

/** Filtres propres à chaque type (en plus des filtres communs : texte, quartier, vérifiés, rayon). */
export const FILTERS_BY_TYPE: Record<SearchType, readonly Filter[]> = {
  annonces: ["categorie", "prix", "dispo", "annonceur"],
  lieux: ["categorie"],
  professionnels: ["categorie"],
  evenements: ["categorie", "quand"],
  guide: [],
};

/** Le guide n'a ni quartier ni position : ces filtres ne s'y appliquent pas. */
export function supportsPlaceFilters(type: SearchType | null): boolean {
  return type !== "guide";
}

export function hasFilter(type: SearchType | null, filter: Filter): boolean {
  return type !== null && FILTERS_BY_TYPE[type].includes(filter);
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(value: string | undefined, allowed: Record<T, unknown>): T | null {
  return value !== undefined && Object.hasOwn(allowed, value) ? (value as T) : null;
}

function slug(value: string | undefined): string | null {
  return value && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null;
}

function amount(value: string | undefined): number | null {
  const digits = value?.replace(/[\s.]/g, "");
  if (!digits || !/^\d+$/.test(digits)) return null;
  const parsed = Number(digits);
  return parsed <= MAX_PRICE ? parsed : null;
}

function integer(value: string | undefined, min: number, max: number): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : null;
}

/** Lit l'adresse, puis retire ce qui ne s'applique pas au type affiché. */
export function parseSearchParams(raw: RawParams): SearchParams {
  const params: SearchParams = {
    q: (first(raw.q) ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH),
    type: oneOf(first(raw.type), SEARCH_TYPES),
    categorie: slug(first(raw.categorie)),
    quartier: slug(first(raw.quartier)),
    verifie: first(raw.verifie) === "1",
    prixMin: amount(first(raw.prix_min)),
    prixMax: amount(first(raw.prix_max)),
    dispo: first(raw.dispo) === "1",
    annonceur: oneOf(first(raw.annonceur), SELLERS),
    quand: oneOf(first(raw.quand), WHEN),
    rayon: integer(first(raw.rayon), 1, 100),
    tri: oneOf(first(raw.tri), SORTS),
    page: integer(first(raw.page), 1, 1000) ?? 1,
    brut: first(raw.brut) === "1",
  };
  return normalizeForType(params);
}

/** Retire les filtres et le tri qui n'ont pas de sens pour le type affiché. */
export function normalizeForType(params: SearchParams): SearchParams {
  const { type } = params;
  const next = { ...params };
  if (!hasFilter(type, "categorie")) next.categorie = null;
  if (!hasFilter(type, "prix")) {
    next.prixMin = null;
    next.prixMax = null;
  }
  if (next.prixMin !== null && next.prixMax !== null && next.prixMin > next.prixMax) {
    [next.prixMin, next.prixMax] = [next.prixMax, next.prixMin];
  }
  if (!hasFilter(type, "dispo")) next.dispo = false;
  if (!hasFilter(type, "annonceur")) next.annonceur = null;
  if (!hasFilter(type, "quand")) next.quand = null;
  if (!supportsPlaceFilters(type)) {
    next.quartier = null;
    next.rayon = null;
  }
  if (type === null || (next.tri !== null && !SORTS_BY_TYPE[type].includes(next.tri))) next.tri = null;
  // Le tri par défaut n'est pas écrit dans l'adresse (une seule adresse par recherche).
  if (type !== null && next.tri === defaultSort(next.q, type)) next.tri = null;
  if (type === null) next.page = 1;
  return next;
}

/** Tri par défaut : la pertinence s'il y a un texte, sinon le premier tri du type. */
export function defaultSort(q: string, type: SearchType): SearchSort {
  return q ? "pertinence" : SORTS_BY_TYPE[type][0]!;
}

/** Tri effectivement appliqué : celui demandé (la distance exige une position), sinon le tri par défaut. */
export function effectiveSort(params: SearchParams, type: SearchType, hasPosition: boolean): SearchSort {
  const sort = params.tri ?? defaultSort(params.q, type);
  return sort === "proximite" && !hasPosition ? defaultSort(params.q, type) : sort;
}

type RawQuery = Record<string, string | string[] | undefined>;

/** Adresse reçue, telle quelle (pour la comparer à sa forme canonique). */
export function rawQueryString(raw: RawQuery): string {
  return new URLSearchParams(
    Object.entries(raw).flatMap(([key, value]) => (value === undefined ? [] : Array.isArray(value) ? value : [value]).map((item) => [key, item])),
  ).toString();
}

/** Adresse (partie requête) d'une recherche ; les valeurs par défaut sont omises. */
export function toQueryString(params: SearchParams): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.type) search.set("type", params.type);
  if (params.categorie) search.set("categorie", params.categorie);
  if (params.quartier) search.set("quartier", params.quartier);
  if (params.verifie) search.set("verifie", "1");
  if (params.prixMin !== null) search.set("prix_min", String(params.prixMin));
  if (params.prixMax !== null) search.set("prix_max", String(params.prixMax));
  if (params.dispo) search.set("dispo", "1");
  if (params.annonceur) search.set("annonceur", params.annonceur);
  if (params.quand) search.set("quand", params.quand);
  if (params.rayon !== null) search.set("rayon", String(params.rayon));
  if (params.tri) search.set("tri", params.tri);
  if (params.page > 1) search.set("page", String(params.page));
  if (params.brut) search.set("brut", "1");
  return search.toString();
}

export function searchHref(base: string, params: SearchParams): string {
  const query = toQueryString(params);
  return query ? `${base}?${query}` : base;
}

/** Modifie une recherche ; tout changement autre que la page revient à la page 1. */
export function withChanges(params: SearchParams, patch: Partial<SearchParams>): SearchParams {
  return normalizeForType({ ...params, page: 1, ...patch });
}

/** Changement d'onglet : seuls les critères communs à tous les types sont conservés. */
export function forType(params: SearchParams, type: SearchType | null): SearchParams {
  return normalizeForType({
    ...EMPTY_SEARCH,
    q: params.q,
    type,
    quartier: params.quartier,
    verifie: params.verifie,
    rayon: params.rayon,
    brut: params.brut,
  });
}

export interface ActiveFilter {
  key: string;
  label: string;
  /** Recherche identique sans ce filtre. */
  without: SearchParams;
}

/** Filtres actifs, chacun retirable individuellement (puces et état « aucun résultat »). */
export function activeFilters(
  params: SearchParams,
  names: { category?: string | null; neighborhood?: string | null } = {},
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  const add = (key: string, label: string, patch: Partial<SearchParams>) =>
    filters.push({ key, label, without: withChanges(params, patch) });

  if (params.categorie) add("categorie", names.category ?? "Catégorie", { categorie: null });
  if (params.quartier) add("quartier", `Quartier : ${names.neighborhood ?? params.quartier}`, { quartier: null });
  if (params.verifie) add("verifie", "Vérifiés uniquement", { verifie: false });
  if (params.prixMin !== null || params.prixMax !== null) add("prix", priceLabel(params.prixMin, params.prixMax), { prixMin: null, prixMax: null });
  if (params.dispo) add("dispo", "Disponibles", { dispo: false });
  if (params.annonceur) add("annonceur", SELLERS[params.annonceur], { annonceur: null });
  if (params.quand) add("quand", WHEN[params.quand], { quand: null });
  if (params.rayon !== null) add("rayon", `Dans un rayon de ${params.rayon} km`, { rayon: null });
  return filters;
}

const NUMBER = new Intl.NumberFormat("fr-FR");

export function priceLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `De ${NUMBER.format(min)} à ${NUMBER.format(max)} FCFA`;
  if (min !== null) return `À partir de ${NUMBER.format(min)} FCFA`;
  if (max !== null) return `Jusqu’à ${NUMBER.format(max)} FCFA`;
  return "Prix";
}
