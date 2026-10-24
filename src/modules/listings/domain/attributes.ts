import { APPLY_MODES, CONTRACTS, DOMAINS, EXPERIENCE, ORGANIZATIONS, REMOTE } from "@/modules/jobs/domain/attributes";
import { EQUIPMENTS } from "@/modules/real-estate/domain/modes";

/**
 * Attributs propres à une catégorie d'annonce (`categories.attribute_schema`),
 * stockés dans `listings.attributes`. Ce registre sert à l'AFFICHAGE : seuls
 * les attributs connus et du bon type sont montrés ; rien n'est déduit ni
 * complété. La saisie est validée par `src/modules/publishing/domain/fields.ts`.
 */

export type AttributeKind =
  | { kind: "text" }
  | { kind: "integer"; unit?: string }
  | { kind: "boolean" }
  | { kind: "date" }
  | { kind: "choice"; options: Record<string, string> }
  | { kind: "list"; options: Record<string, string> };

export interface AttributeDefinition {
  label: string;
  type: AttributeKind;
}

/** État d'un objet, d'un véhicule ou d'une pièce (déclaré par l'annonceur, jamais vérifié par la plateforme). */
export const CONDITIONS = { neuf: "Neuf", tres_bon: "Très bon état", bon: "Bon état", correct: "État correct", pour_pieces: "À réparer" } as const;

export const ATTRIBUTE_SCHEMAS: Record<string, Record<string, AttributeDefinition>> = {
  immobilier: {
    type_bien: {
      label: "Type de bien",
      type: {
        kind: "choice",
        options: {
          studio: "Studio",
          appartement: "Appartement",
          maison: "Maison",
          villa: "Villa",
          chambre: "Chambre",
          duplex: "Duplex",
          bureau: "Bureau",
          magasin: "Magasin",
          terrain: "Terrain",
        },
      },
    },
    pieces: { label: "Pièces", type: { kind: "integer" } },
    chambres: { label: "Chambres", type: { kind: "integer" } },
    surface_m2: { label: "Surface", type: { kind: "integer", unit: "m²" } },
    salles_de_bain: { label: "Salles de bain", type: { kind: "integer" } },
    etage: { label: "Étage", type: { kind: "integer" } },
    meuble: { label: "Meublé", type: { kind: "boolean" } },
    equipements: { label: "Équipements déclarés", type: { kind: "list", options: EQUIPMENTS } },
  },
  emploi: {
    contrat: { label: "Contrat", type: { kind: "choice", options: CONTRACTS } },
    domaine: { label: "Domaine", type: { kind: "choice", options: DOMAINS } },
    secteur: { label: "Secteur", type: { kind: "text" } },
    experience: { label: "Expérience demandée", type: { kind: "choice", options: EXPERIENCE } },
    teletravail: { label: "Lieu de travail", type: { kind: "choice", options: REMOTE } },
    organisation: { label: "Type d’organisation", type: { kind: "choice", options: ORGANIZATIONS } },
    date_limite: { label: "Date limite de candidature", type: { kind: "date" } },
    candidature: { label: "Candidature", type: { kind: "choice", options: APPLY_MODES } },
  },
  vehicule: {
    marque: { label: "Marque", type: { kind: "text" } },
    modele: { label: "Modèle", type: { kind: "text" } },
    annee: { label: "Année", type: { kind: "integer" } },
    kilometrage: { label: "Kilométrage", type: { kind: "integer", unit: "km" } },
    carburant: {
      label: "Carburant",
      type: { kind: "choice", options: { essence: "Essence", diesel: "Diesel", electrique: "Électrique", hybride: "Hybride" } },
    },
    boite: { label: "Transmission", type: { kind: "choice", options: { manuelle: "Manuelle", automatique: "Automatique" } } },
    etat: { label: "État général", type: { kind: "choice", options: CONDITIONS } },
  },
  piece: {
    type_piece: { label: "Type de pièce", type: { kind: "text" } },
    etat: { label: "État", type: { kind: "choice", options: CONDITIONS } },
    marque: { label: "Marque", type: { kind: "text" } },
    compatibilite: { label: "Compatibilité (modèles, années)", type: { kind: "text" } },
  },
  bien: {
    etat: { label: "État", type: { kind: "choice", options: CONDITIONS } },
    marque: { label: "Marque", type: { kind: "text" } },
  },
  service: {
    zone_intervention: { label: "Zone d’intervention", type: { kind: "text" } },
    deplacement: { label: "Se déplace à domicile", type: { kind: "boolean" } },
  },
  formation: {
    duree: { label: "Durée", type: { kind: "text" } },
    niveau: { label: "Niveau", type: { kind: "text" } },
    certifiante: { label: "Certifiante", type: { kind: "boolean" } },
  },
  opportunite: {
    date_limite: { label: "Date limite", type: { kind: "date" } },
  },
  appel_offres: {
    reference: { label: "Référence", type: { kind: "text" } },
    date_limite: { label: "Date limite de dépôt", type: { kind: "date" } },
  },
};

/** Schémas proposés à l'administration pour une catégorie d'annonce (champs définis ci-dessus). */
export const SCHEMA_LABELS: Record<string, string> = {
  bien: "Biens et objets (état, marque)",
  vehicule: "Véhicule complet (marque, modèle, année, kilométrage, carburant, transmission, état)",
  piece: "Pièces et accessoires (type, état, marque, compatibilité)",
  immobilier: "Immobilier (type de bien, pièces, surface, équipements)",
  service: "Service (zone d’intervention, déplacement)",
  formation: "Formation (durée, niveau, certification)",
  emploi: "Offre d’emploi (parcours dédié)",
  opportunite: "Opportunité (parcours dédié)",
  appel_offres: "Appel d’offres (parcours dédié)",
};

/** Filtres proposés par schéma : seuls ces champs servent de critères de recherche. */
export const FILTERABLE_FIELDS: Record<string, readonly string[]> = {
  bien: ["etat", "marque"],
  vehicule: ["marque", "annee", "kilometrage", "carburant", "boite", "etat"],
  piece: ["etat", "marque", "type_piece"],
  immobilier: ["type_bien", "chambres", "meuble"],
};

/** Champs du schéma activés pour une catégorie (null : tous), dans l'ordre du registre. */
export function activeDefinitions(schema: string | null | undefined, fields: readonly string[] | null | undefined): [string, AttributeDefinition][] {
  const definitions = schema ? ATTRIBUTE_SCHEMAS[schema] : undefined;
  if (!definitions) return [];
  return Object.entries(definitions).filter(([key]) => !fields || fields.includes(key));
}

/** Filtres d'une catégorie : champs filtrables du schéma, parmi ses champs actifs. */
export function categoryFilters(schema: string | null | undefined, fields: readonly string[] | null | undefined): [string, AttributeDefinition][] {
  const filterable = schema ? (FILTERABLE_FIELDS[schema] ?? []) : [];
  return activeDefinitions(schema, fields).filter(([key]) => filterable.includes(key));
}

const NUMBER = new Intl.NumberFormat("fr-FR");
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

function formatValue(definition: AttributeDefinition, value: unknown): string | null {
  const { type } = definition;
  switch (type.kind) {
    case "text":
      return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 200) : null;
    case "integer":
      return typeof value === "number" && Number.isInteger(value) && value >= 0
        ? `${NUMBER.format(value)}${type.unit ? ` ${type.unit}` : ""}`
        : null;
    case "boolean":
      return typeof value === "boolean" ? (value ? "Oui" : "Non") : null;
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : DATE.format(date);
    }
    case "choice":
      return typeof value === "string" && Object.hasOwn(type.options, value) ? type.options[value]! : null;
    case "list": {
      if (!Array.isArray(value)) return null;
      const labels = value.filter((item): item is string => typeof item === "string" && Object.hasOwn(type.options, item)).map((item) => type.options[item]!);
      return labels.length ? labels.join(", ") : null;
    }
  }
}

/** Attributs affichables, dans l'ordre du registre ; valeurs inconnues ou mal typées ignorées. */
export function displayAttributes(schema: string | null | undefined, attributes: unknown): { label: string; value: string }[] {
  const definitions = schema ? ATTRIBUTE_SCHEMAS[schema] : undefined;
  if (!definitions || !attributes || typeof attributes !== "object" || Array.isArray(attributes)) return [];
  const values = attributes as Record<string, unknown>;
  return Object.entries(definitions).flatMap(([key, definition]) => {
    const value = formatValue(definition, values[key]);
    return value === null ? [] : [{ label: definition.label, value }];
  });
}
