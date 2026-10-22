/**
 * Attributs touristiques déclarés d'un lieu. Clés identiques aux contraintes
 * SQL (migration 20261025000100_tourism.sql) : une clé inconnue est refusée.
 */

export const THEMES = {
  nature: "Nature",
  plage: "Plage",
  culture: "Culture",
  histoire: "Histoire",
  gastronomie: "Gastronomie",
  sport: "Sport",
  detente: "Détente",
  artisanat: "Artisanat",
  vie_nocturne: "Vie nocturne",
} as const;
export type Theme = keyof typeof THEMES;

export const AUDIENCES = {
  familles: "Familles",
  enfants: "Enfants",
  couples: "Couples",
  groupes: "Groupes",
  seniors: "Seniors",
} as const;
export type Audience = keyof typeof AUDIENCES;

/** Durée de visite indicative, de la plus courte à la plus longue. */
export const VISIT_DURATIONS = {
  moins_1h: "Moins d’une heure",
  une_2h: "1 à 2 heures",
  demi_journee: "Une demi-journée",
  journee: "Une journée",
} as const;
export type VisitDuration = keyof typeof VISIT_DURATIONS;

export const ACCESSIBILITY = {
  fauteuil_roulant: "Accessible en fauteuil roulant",
  poussette: "Accessible avec une poussette",
  stationnement_proche: "Stationnement à proximité",
  acces_voiture: "Accessible en voiture",
} as const;
export type Accessibility = keyof typeof ACCESSIBILITY;

/** Message honnête quand une donnée manque (cahier des charges, niveau 12). */
export const TO_CONFIRM = "Information à confirmer localement";

const has = <T extends object>(table: T) => (value: string): value is Extract<keyof T, string> => Object.hasOwn(table, value);
export const isTheme = has(THEMES);
export const isAudience = has(AUDIENCES);
export const isVisitDuration = has(VISIT_DURATIONS);
export const isAccessibility = has(ACCESSIBILITY);

/** Libellés connus, dans l'ordre du référentiel ; une valeur inconnue est ignorée. */
export function labels<T extends Record<string, string>>(table: T, values: readonly string[]): string[] {
  return Object.entries(table)
    .filter(([key]) => values.includes(key))
    .map(([, label]) => label);
}

export function durationRank(value: string | null): number | null {
  const index = value ? Object.keys(VISIT_DURATIONS).indexOf(value) : -1;
  return index >= 0 ? index + 1 : null;
}
