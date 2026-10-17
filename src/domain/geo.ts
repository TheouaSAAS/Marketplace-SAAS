/**
 * Utilitaires géographiques purs (sans dépendance au navigateur).
 * La recherche de proximité elle-même est faite en base (PostGIS) ; ces
 * fonctions servent à l'affichage et aux contrôles côté client.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

export function isValidLatLng(point: Partial<LatLng> | null | undefined): point is LatLng {
  return (
    !!point &&
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

/** Distance orthodromique (formule de haversine), en mètres. */
export function distanceInMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const kmFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** « 850 m », « 1,2 km », « 12 km ». Arrondi volontaire : une distance n'est jamais exacte au mètre. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "Distance inconnue";
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km >= 10 ? Math.round(km) : kmFormatter.format(km)} km`;
}

export type AccuracyLevel = "precise" | "approximate" | "coarse";

/** Interprète `position.coords.accuracy` (rayon d'incertitude en mètres, au niveau de confiance de 95 %). */
export function accuracyLevel(accuracyMeters: number): AccuracyLevel {
  if (accuracyMeters <= 50) return "precise";
  if (accuracyMeters <= 1000) return "approximate";
  return "coarse";
}

export function describeAccuracy(accuracyMeters: number): string {
  const around = formatDistance(accuracyMeters);
  switch (accuracyLevel(accuracyMeters)) {
    case "precise":
      return `Position précise (à environ ${around} près)`;
    case "approximate":
      return `Position approximative (à environ ${around} près)`;
    case "coarse":
      return `Position peu précise (à environ ${around} près) : les distances sont indicatives`;
  }
}

/** Rayons de recherche proposés (§3.9.E), en mètres. */
export const SEARCH_RADII_M = [1_000, 5_000, 10_000, 25_000] as const;
