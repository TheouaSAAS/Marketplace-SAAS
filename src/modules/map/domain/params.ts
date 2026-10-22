/**
 * Critères de la carte dans l'adresse (forme canonique) : couches, quartier,
 * zone. La position de la personne n'y figure jamais (cookie arrondi, niveau 7).
 */
import { ALL_LAYERS, isMapLayer, type MapLayer } from "./layers";

export interface MapZone {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapFilters {
  couches: MapLayer[];
  quartier: string | null;
  zone: MapZone | null;
}

type Raw = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const round = (value: number) => Math.round(value * 10_000) / 10_000;

export function parseZone(value: string | undefined): MapZone | null {
  const parts = value?.split(",").map(Number);
  if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [west, south, east, north] = parts.map(round) as [number, number, number, number];
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null;
  // Une zone démesurée (plus de 2° de côté) n'a pas de sens à l'échelle d'une ville.
  if (east - west > 2 || north - south > 2) return null;
  return { west, south, east, north };
}

export function parseMapFilters(raw: Raw): MapFilters {
  // Cases cochées (paramètres répétés) ou forme canonique (liste séparée par des virgules).
  const values = raw.couches === undefined ? null : (Array.isArray(raw.couches) ? raw.couches : [raw.couches]).flatMap((value) => value.split(","));
  const asked = values === null ? ALL_LAYERS : values.filter(isMapLayer);
  const quartier = first(raw.quartier);
  return {
    // Ordre de la légende, sans doublon : une même sélection donne une seule adresse.
    couches: ALL_LAYERS.filter((layer) => asked.includes(layer)),
    quartier: quartier && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(quartier) ? quartier : null,
    zone: parseZone(first(raw.zone)),
  };
}

export function mapQuery(filters: MapFilters): string {
  const query = new URLSearchParams();
  // Toutes les couches : valeur par défaut, omise.
  if (filters.couches.length !== ALL_LAYERS.length) query.set("couches", filters.couches.join(","));
  if (filters.quartier) query.set("quartier", filters.quartier);
  if (filters.zone) query.set("zone", [filters.zone.west, filters.zone.south, filters.zone.east, filters.zone.north].join(","));
  return query.toString();
}
