/**
 * Les quatre entrées de l'immobilier. Chacune correspond à des catégories du
 * référentiel (administrables) ; « temporaire » est une location facturée à
 * la nuit ou à la journée.
 */
export const REAL_ESTATE_MODES = {
  location: {
    label: "Location",
    title: "Logements à louer",
    description: "Studios, appartements, maisons et chambres à louer au mois.",
    categories: ["immobilier-location"],
    shortStay: false,
  },
  vente: {
    label: "Vente",
    title: "Biens et terrains à vendre",
    description: "Maisons, appartements et terrains proposés à la vente.",
    categories: ["immobilier-vente", "terrains"],
    shortStay: false,
  },
  temporaire: {
    label: "Séjour temporaire",
    title: "Locations de courte durée",
    description: "Logements meublés loués à la nuit ou à la journée.",
    categories: ["immobilier-location"],
    shortStay: true,
  },
  professionnel: {
    label: "Locaux professionnels",
    title: "Bureaux et locaux commerciaux",
    description: "Bureaux, magasins et locaux d’activité à louer ou à vendre.",
    categories: ["locaux-professionnels"],
    shortStay: false,
  },
} as const;

export type RealEstateMode = keyof typeof REAL_ESTATE_MODES;
export const REAL_ESTATE_MODE_KEYS = Object.keys(REAL_ESTATE_MODES) as RealEstateMode[];

export function isRealEstateMode(value: string): value is RealEstateMode {
  return Object.hasOwn(REAL_ESTATE_MODES, value);
}

/** Équipements déclarables (attribut `equipements`, liste de clés). */
export const EQUIPMENTS = {
  climatisation: "Climatisation",
  eau_courante: "Eau courante",
  electricite: "Électricité",
  compteur_individuel: "Compteur individuel",
  forage: "Forage",
  groupe_electrogene: "Groupe électrogène",
  parking: "Parking",
  gardien: "Gardien",
  cuisine_equipee: "Cuisine équipée",
  internet: "Internet",
} as const;

export type Equipment = keyof typeof EQUIPMENTS;
export const EQUIPMENT_KEYS = Object.keys(EQUIPMENTS) as Equipment[];

/** Types de bien proposés selon l'entrée. */
export const PROPERTY_TYPES_BY_MODE: Record<RealEstateMode, readonly string[]> = {
  location: ["studio", "chambre", "appartement", "maison", "villa", "duplex"],
  vente: ["appartement", "maison", "villa", "duplex", "terrain"],
  temporaire: ["studio", "chambre", "appartement", "maison", "villa"],
  professionnel: ["bureau", "magasin"],
};
