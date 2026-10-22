import { EQUIPMENT_KEYS, PROPERTY_TYPES_BY_MODE, type Equipment, type RealEstateMode } from "./modes";

/**
 * Filtres immobiliers dans l'adresse (partageable). Lecture tolérante : une
 * valeur invalide ou inadaptée à l'entrée (location, vente…) est ignorée.
 */

export const RE_SORTS = {
  recent: "Les plus récentes",
  prix_asc: "Prix croissant",
  prix_desc: "Prix décroissant",
  surface_desc: "Surface décroissante",
} as const;
export type RealEstateSort = keyof typeof RE_SORTS;

export interface RealEstateFilters {
  q: string;
  typeBien: string | null;
  piecesMin: number | null;
  chambresMin: number | null;
  surfaceMin: number | null;
  meuble: boolean | null;
  prixMin: number | null;
  prixMax: number | null;
  dispo: boolean;
  confirmee: boolean;
  quartier: string | null;
  equipements: Equipment[];
  tri: RealEstateSort | null;
  page: number;
}

export const EMPTY_FILTERS: RealEstateFilters = {
  q: "",
  typeBien: null,
  piecesMin: null,
  chambresMin: null,
  surfaceMin: null,
  meuble: null,
  prixMin: null,
  prixMax: null,
  dispo: false,
  confirmee: false,
  quartier: null,
  equipements: [],
  tri: null,
  page: 1,
};

type Raw = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function int(value: string | undefined, max: number): number | null {
  const digits = value?.replace(/[\s.]/g, "");
  if (!digits || !/^\d+$/.test(digits)) return null;
  const parsed = Number(digits);
  return parsed > 0 && parsed <= max ? parsed : null;
}

export function parseRealEstateFilters(raw: Raw, mode: RealEstateMode): RealEstateFilters {
  const typeBien = first(raw.type_bien);
  const meuble = first(raw.meuble);
  const tri = first(raw.tri);
  const quartier = first(raw.quartier);
  const filters: RealEstateFilters = {
    q: (first(raw.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    typeBien: typeBien && PROPERTY_TYPES_BY_MODE[mode].includes(typeBien) ? typeBien : null,
    piecesMin: int(first(raw.pieces), 20),
    chambresMin: int(first(raw.chambres), 20),
    surfaceMin: int(first(raw.surface), 100_000),
    meuble: meuble === "oui" ? true : meuble === "non" ? false : null,
    prixMin: int(first(raw.prix_min), 1_000_000_000_000),
    prixMax: int(first(raw.prix_max), 1_000_000_000_000),
    dispo: first(raw.dispo) === "1",
    confirmee: first(raw.confirmee) === "1",
    quartier: quartier && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(quartier) ? quartier : null,
    // Cases à cocher (paramètre répété) ou liste « a,b » (adresse canonique).
    equipements: [...new Set([raw.equipements ?? []].flat().flatMap((value) => value.split(",")))].filter((key): key is Equipment =>
      (EQUIPMENT_KEYS as string[]).includes(key),
    ),
    tri: tri && Object.hasOwn(RE_SORTS, tri) && tri !== "recent" ? (tri as RealEstateSort) : null,
    page: int(first(raw.page), 1000) ?? 1,
  };
  // Un terrain ou un local n'a ni pièces, ni chambres, ni mobilier.
  if (mode === "professionnel" || filters.typeBien === "terrain") {
    filters.piecesMin = null;
    filters.chambresMin = null;
    filters.meuble = null;
  }
  if (filters.prixMin !== null && filters.prixMax !== null && filters.prixMin > filters.prixMax) {
    [filters.prixMin, filters.prixMax] = [filters.prixMax, filters.prixMin];
  }
  return filters;
}

/** Forme canonique (valeurs par défaut omises, ordre fixe). */
export function realEstateQuery(filters: RealEstateFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.typeBien) query.set("type_bien", filters.typeBien);
  if (filters.piecesMin) query.set("pieces", String(filters.piecesMin));
  if (filters.chambresMin) query.set("chambres", String(filters.chambresMin));
  if (filters.surfaceMin) query.set("surface", String(filters.surfaceMin));
  if (filters.meuble !== null) query.set("meuble", filters.meuble ? "oui" : "non");
  if (filters.prixMin) query.set("prix_min", String(filters.prixMin));
  if (filters.prixMax) query.set("prix_max", String(filters.prixMax));
  if (filters.dispo) query.set("dispo", "1");
  if (filters.confirmee) query.set("confirmee", "1");
  if (filters.quartier) query.set("quartier", filters.quartier);
  if (filters.equipements.length) query.set("equipements", [...filters.equipements].sort().join(","));
  if (filters.tri) query.set("tri", filters.tri);
  if (filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
}

export function withFilters(filters: RealEstateFilters, patch: Partial<RealEstateFilters>): RealEstateFilters {
  return { ...filters, page: 1, ...patch };
}
