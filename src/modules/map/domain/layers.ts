/**
 * Couches de la carte. Chaque couche correspond à des catégories du
 * référentiel (fonction SQL `map_features`) ; la couleur sert aussi à la
 * légende (accessibilité : le libellé accompagne toujours la couleur).
 */

export const MAP_LAYERS = {
  immobilier: { label: "Immobilier", color: "#0f5c73" },
  services: { label: "Services", color: "#7c3aed" },
  commerces: { label: "Commerces", color: "#c2410c" },
  tourisme: { label: "Tourisme", color: "#15803d" },
  evenements: { label: "Événements", color: "#be185d" },
  emploi: { label: "Emploi", color: "#475569" },
} as const;

export type MapLayer = keyof typeof MAP_LAYERS;

export const ALL_LAYERS = Object.keys(MAP_LAYERS) as MapLayer[];

export function isMapLayer(value: string): value is MapLayer {
  return Object.hasOwn(MAP_LAYERS, value);
}

/** Couche annoncée mais sans données géolocalisées : affichée désactivée, avec la raison. */
export const UNAVAILABLE_LAYERS = [
  { key: "guide", label: "Points du guide", reason: "Les articles du guide n’ont pas de position : ils restent accessibles depuis le guide." },
] as const;

export interface MapFeature {
  layer: MapLayer;
  id: string;
  slug: string;
  title: string;
  category: string | null;
  verification_status: "verified" | "pending_validation" | "placeholder" | "archived" | "rejected";
  verified_at: string | null;
  location_precision: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  starts_at: string | null;
}

/** Itinéraire confié à une application cartographique, seulement vers un point exact. */
export function directionsHref(feature: Pick<MapFeature, "lat" | "lng" | "location_precision">): string | null {
  return feature.location_precision === "exact" ? `https://www.openstreetmap.org/directions?to=${feature.lat}%2C${feature.lng}` : null;
}
