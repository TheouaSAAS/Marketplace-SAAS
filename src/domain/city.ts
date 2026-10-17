/**
 * Notions de ville partagées par le serveur et le navigateur. Module pur, sans
 * accès à l'environnement : il peut être importé par des composants clients
 * sans alourdir leur bundle.
 */

export interface CitySummary {
  /** null pour la ville de repli lorsque la base n'est pas joignable. */
  id: string | null;
  slug: string;
  name: string;
}

/** Nom du cookie qui mémorise la ville choisie (slug uniquement, aucune donnée personnelle). */
export const CITY_COOKIE = "cdp_ville";

/**
 * Ville de lancement. Le centre est approximatif (centre-ville) et ne sert qu'à
 * positionner la carte par défaut, jamais à calculer une distance.
 */
export const LAUNCH_CITY = {
  slug: "san-pedro",
  name: "San Pedro",
  center: { lat: 4.7485, lng: -6.6363 },
  defaultZoom: 13,
} as const;

/** Retient la ville demandée si elle existe, sinon la ville par défaut, sinon la première, sinon le repli. */
export function resolveCity(
  cities: readonly CitySummary[],
  requestedSlug: string | undefined,
  fallback: CitySummary,
): CitySummary {
  return (
    cities.find((city) => city.slug === requestedSlug) ??
    cities.find((city) => city.slug === fallback.slug) ??
    cities[0] ??
    fallback
  );
}
