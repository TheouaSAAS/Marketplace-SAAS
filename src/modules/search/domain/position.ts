/**
 * Position du visiteur pour « autour de moi ».
 *
 * Obtenue uniquement après accord explicite (bouton + autorisation du
 * navigateur), arrondie à environ 100 m, conservée 30 minutes dans un cookie
 * du navigateur et jamais enregistrée par la plateforme. Elle n'apparaît
 * jamais dans l'adresse : une recherche partagée ne révèle pas la position
 * de la personne qui la partage.
 */

export const POSITION_COOKIE = "cdp_position";
export const POSITION_MAX_AGE_SECONDS = 30 * 60;

export interface Position {
  lat: number;
  lng: number;
}

/** Trois décimales : environ 110 m. */
export function roundPosition({ lat, lng }: Position): Position {
  return { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 };
}

export function formatPositionCookie(position: Position): string {
  const { lat, lng } = roundPosition(position);
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function parsePositionCookie(value: string | undefined | null): Position | null {
  const match = value ? /^(-?\d{1,2}\.\d{1,3}),(-?\d{1,3}\.\d{1,3})$/.exec(value) : null;
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const KM = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Distance affichée ; « environ » quand la position publiée est volontairement arrondie. */
export function formatDistance(meters: number, approximate: boolean): string {
  const label = meters < 1000 ? `${Math.max(100, Math.round(meters / 100) * 100)} m` : `${KM.format(meters / 1000)} km`;
  return approximate ? `à environ ${label}` : `à ${label}`;
}
