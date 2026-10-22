/**
 * Critères de l'annuaire des commerces, dans l'adresse (forme canonique).
 * « type » = une vue du référentiel (restaurants, alimentation, boutiques…).
 */
import { isShopAmbiance, isShopFeature, type ShopAmbiance, type ShopFeature } from "./attributes";

export interface ShopFilters {
  q: string;
  type: string | null;
  quartier: string | null;
  budget: number | null;
  ambiance: ShopAmbiance[];
  services: ShopFeature[];
  verifie: boolean;
  rayon: number | null;
  tri: "proximite" | null;
  page: number;
}

export const EMPTY_SHOP_FILTERS: ShopFilters = {
  q: "",
  type: null,
  quartier: null,
  budget: null,
  ambiance: [],
  services: [],
  verifie: false,
  rayon: null,
  tri: null,
  page: 1,
};

type Raw = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const all = (value: string | string[] | undefined) => (Array.isArray(value) ? value : value ? value.split(",") : []);
const slug = (value: string | undefined) => (value && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null);
const int = (value: string | undefined, max: number) => (value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null);

export function parseShopFilters(raw: Raw): ShopFilters {
  return {
    q: (first(raw.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    type: slug(first(raw.type)),
    quartier: slug(first(raw.quartier)),
    budget: int(first(raw.budget), 4),
    // Ordre du référentiel, sans doublon : une même sélection donne une seule adresse.
    ambiance: [...new Set(all(raw.ambiance).filter(isShopAmbiance))].sort(),
    services: [...new Set(all(raw.services).filter(isShopFeature))].sort(),
    verifie: first(raw.verifie) === "1",
    rayon: int(first(raw.rayon), 100),
    tri: first(raw.tri) === "proximite" ? "proximite" : null,
    page: int(first(raw.page), 1000) ?? 1,
  };
}

export function shopQuery(filters: ShopFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.type) query.set("type", filters.type);
  if (filters.quartier) query.set("quartier", filters.quartier);
  if (filters.budget) query.set("budget", String(filters.budget));
  if (filters.ambiance.length) query.set("ambiance", filters.ambiance.join(","));
  if (filters.services.length) query.set("services", filters.services.join(","));
  if (filters.verifie) query.set("verifie", "1");
  if (filters.rayon) query.set("rayon", String(filters.rayon));
  if (filters.tri) query.set("tri", filters.tri);
  if (filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
}

/** Règle de classement affichée (« Pourquoi cet ordre ? »). */
export const SHOPS_RANKING_RULE =
  "D’abord les commerces dont les informations ont été vérifiées par l’équipe locale (vérification de moins d’un an), puis ceux dont les horaires ont été vérifiés (moins de 6 mois), puis les fiches les plus récemment mises à jour. Avec votre position, vous pouvez trier par distance. Les commerces sponsorisés apparaissent à part, étiquetés « Sponsorisé » : ils ne changent pas cet ordre.";
