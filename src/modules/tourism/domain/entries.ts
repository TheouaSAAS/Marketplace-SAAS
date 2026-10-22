/**
 * Les quatre entrées « Découvrir et sortir » : chacune regroupe des catégories
 * du référentiel (administrables). « Sortir » ajoute les événements à venir.
 */

export const TOURISM_ENTRIES = {
  "ou-dormir": {
    title: "Où dormir ?",
    intro: "Hôtels, résidences et hébergements de San Pedro et des environs.",
    categories: ["hotels-hebergements"],
  },
  "ou-manger": {
    title: "Où manger ?",
    intro: "Restaurants, maquis et tables de San Pedro.",
    categories: ["restaurants-gastronomie"],
  },
  "que-decouvrir": {
    title: "Que découvrir ?",
    intro: "Sites naturels, plages, lieux à visiter, excursions et guides.",
    categories: ["lieux-a-visiter", "plages-sites-naturels", "excursions-guides"],
  },
  sortir: {
    title: "Sortir",
    intro: "Loisirs, activités et événements à venir.",
    categories: ["loisirs-activites"],
  },
} as const;

export type TourismEntry = keyof typeof TOURISM_ENTRIES;

export function isTourismEntry(value: string): value is TourismEntry {
  return Object.hasOwn(TOURISM_ENTRIES, value);
}

/** Toutes les catégories touristiques (exploration générale, itinéraires). */
export const TOURISM_CATEGORIES: string[] = Object.values(TOURISM_ENTRIES).flatMap((entry) => [...entry.categories]);

/** Règles de prudence générales, sans aucune donnée locale (rien d'inventé sur San Pedro). */
export const TOURISM_ADVICE = [
  "Vérifiez les horaires et l’accès auprès du lieu ou de l’opérateur avant de vous déplacer : une information « à confirmer » peut avoir changé.",
  "Pour la baignade, renseignez-vous sur place sur les courants et la météo ; ne vous baignez pas seul hors des zones surveillées.",
  "Convenez du prix d’une excursion ou d’un transport avant le départ, et ne payez jamais d’avance à un inconnu.",
  "Signalez une fiche inexacte : la correction profite à tous.",
];
