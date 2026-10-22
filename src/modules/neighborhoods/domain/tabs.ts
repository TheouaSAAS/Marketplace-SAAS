/**
 * Onglets d'une fiche quartier. Chaque onglet ne montre que les contenus
 * rattachés au quartier (relation réelle) et renvoie vers la page du domaine
 * filtrée sur ce quartier. Aucun qualificatif (sûr, calme, meilleur…).
 */

export const NEIGHBORHOOD_TABS = {
  decouvrir: {
    label: "À découvrir",
    categories: ["lieux-a-visiter", "plages-sites-naturels", "loisirs-activites"],
    empty: "Aucun lieu à découvrir ni événement à venir n’est rattaché à ce quartier pour l’instant.",
  },
  logement: {
    label: "Logement",
    categories: ["immobilier"],
    empty: "Aucune annonce immobilière n’est rattachée à ce quartier pour l’instant.",
  },
  services: {
    label: "Services",
    categories: ["services-professionnels", "transport-livraison"],
    empty: "Aucun professionnel n’est rattaché à ce quartier pour l’instant.",
  },
  commerces: {
    label: "Commerces",
    categories: ["commerces-boutiques", "restaurants-gastronomie"],
    empty: "Aucun commerce n’est rattaché à ce quartier pour l’instant.",
  },
  tourisme: {
    label: "Tourisme",
    categories: ["hotels-hebergements", "excursions-guides"],
    empty: "Aucun hébergement ni opérateur touristique n’est rattaché à ce quartier pour l’instant.",
  },
  carte: { label: "Carte", categories: [], empty: "" },
} as const;

export type NeighborhoodTab = keyof typeof NEIGHBORHOOD_TABS;

export function parseTab(value: unknown): NeighborhoodTab {
  return typeof value === "string" && Object.hasOwn(NEIGHBORHOOD_TABS, value) ? (value as NeighborhoodTab) : "decouvrir";
}

/** Rappel de neutralité affiché sur chaque fiche (cahier des charges, niveau 14). */
export const NEIGHBORHOOD_NEUTRALITY =
  "Cette fiche ne classe pas les quartiers et ne les qualifie pas (sûr, calme, pratique…) : elle présente seulement les contenus enregistrés qui y sont rattachés par leurs auteurs.";

export function boundaryNotice(hasBoundary: boolean): string | null {
  return hasBoundary
    ? null
    : "Pas de périmètre validé : les contenus sont rattachés au quartier indiqué par leurs auteurs, sans limite tracée. Le découpage reste à confirmer localement.";
}
