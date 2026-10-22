/**
 * Attributs déclarés d'une vitrine. Clés identiques aux contraintes SQL
 * (migration 20261024000100_shops.sql) : une clé inconnue est refusée en base.
 */

export const SHOP_FEATURES = {
  livraison: "Livraison",
  a_emporter: "À emporter",
  sur_place: "Sur place",
  reservation: "Réservation",
  paiement_mobile: "Paiement mobile",
  carte_bancaire: "Carte bancaire",
  parking: "Parking",
  climatise: "Climatisé",
  wifi: "Wi-Fi",
  terrasse: "Terrasse",
  acces_facile: "Accès de plain-pied",
} as const;
export type ShopFeature = keyof typeof SHOP_FEATURES;

export const SHOP_AMBIANCES = {
  familiale: "Familiale",
  calme: "Calme",
  festive: "Festive",
  decontractee: "Décontractée",
  chic: "Chic",
  plein_air: "En plein air",
} as const;
export type ShopAmbiance = keyof typeof SHOP_AMBIANCES;

/** Budget indicatif (niveau 1 à 4) : un ordre de grandeur, jamais un prix. */
export const BUDGET_LEVELS = {
  1: "Petit budget",
  2: "Budget moyen",
  3: "Assez cher",
  4: "Haut de gamme",
} as const;
export type BudgetLevel = 1 | 2 | 3 | 4;

export function isShopFeature(value: string): value is ShopFeature {
  return Object.hasOwn(SHOP_FEATURES, value);
}

export function isShopAmbiance(value: string): value is ShopAmbiance {
  return Object.hasOwn(SHOP_AMBIANCES, value);
}

export function budgetLabel(level: number | null): string | null {
  return level && level >= 1 && level <= 4 ? `${BUDGET_LEVELS[level as BudgetLevel]} (indicatif)` : null;
}

/** Libellés des attributs connus, dans l'ordre du référentiel ; une valeur inconnue est ignorée. */
export function featureLabels(values: readonly string[]): string[] {
  return (Object.keys(SHOP_FEATURES) as ShopFeature[]).filter((key) => values.includes(key)).map((key) => SHOP_FEATURES[key]);
}

export function ambianceLabels(values: readonly string[]): string[] {
  return (Object.keys(SHOP_AMBIANCES) as ShopAmbiance[]).filter((key) => values.includes(key)).map((key) => SHOP_AMBIANCES[key]);
}
