/**
 * Critères d'exploration touristique, dans l'adresse (forme canonique).
 * Les mêmes critères servent à « Où dormir ? », « Où manger ? », etc.
 */
import { isAccessibility, isAudience, isTheme, isVisitDuration, type Accessibility, type Audience, type Theme, type VisitDuration } from "./attributes";

export interface TourismFilters {
  q: string;
  type: string | null;
  quartier: string | null;
  themes: Theme[];
  public: Audience[];
  duree: VisitDuration | null;
  budget: number | null;
  acces: Accessibility[];
  verifie: boolean;
  rayon: number | null;
  tri: "proximite" | null;
  page: number;
}

export const EMPTY_TOURISM_FILTERS: TourismFilters = {
  q: "",
  type: null,
  quartier: null,
  themes: [],
  public: [],
  duree: null,
  budget: null,
  acces: [],
  verifie: false,
  rayon: null,
  tri: null,
  page: 1,
};

type Raw = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const all = (value: string | string[] | undefined) => (Array.isArray(value) ? value.flatMap((item) => item.split(",")) : value ? value.split(",") : []);
const slug = (value: string | undefined) => (value && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null);
const int = (value: string | undefined, max: number) => (value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null);
const keys = <T extends string>(value: string | string[] | undefined, guard: (item: string) => item is T): T[] => [...new Set(all(value).filter(guard))].sort();

export function parseTourismFilters(raw: Raw): TourismFilters {
  const duree = first(raw.duree);
  return {
    q: (first(raw.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    type: slug(first(raw.type)),
    quartier: slug(first(raw.quartier)),
    themes: keys(raw.themes, isTheme),
    public: keys(raw.public, isAudience),
    duree: duree && isVisitDuration(duree) ? duree : null,
    budget: int(first(raw.budget), 4),
    acces: keys(raw.acces, isAccessibility),
    verifie: first(raw.verifie) === "1",
    rayon: int(first(raw.rayon), 200),
    tri: first(raw.tri) === "proximite" ? "proximite" : null,
    page: int(first(raw.page), 1000) ?? 1,
  };
}

export function tourismQuery(filters: TourismFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.type) query.set("type", filters.type);
  if (filters.quartier) query.set("quartier", filters.quartier);
  if (filters.themes.length) query.set("themes", filters.themes.join(","));
  if (filters.public.length) query.set("public", filters.public.join(","));
  if (filters.duree) query.set("duree", filters.duree);
  if (filters.budget) query.set("budget", String(filters.budget));
  if (filters.acces.length) query.set("acces", filters.acces.join(","));
  if (filters.verifie) query.set("verifie", "1");
  if (filters.rayon) query.set("rayon", String(filters.rayon));
  if (filters.tri) query.set("tri", filters.tri);
  if (filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
}

/** Règle de classement affichée (« Pourquoi cet ordre ? »). */
export const TOURISM_RANKING_RULE =
  "D’abord les lieux dont les informations ont été vérifiées par l’équipe locale (vérification de moins d’un an), puis ceux qui couvrent le plus de thèmes choisis, puis les fiches les plus récemment mises à jour. Avec votre position, vous pouvez trier par distance. Aucun lieu ne paie pour être mieux classé.";
