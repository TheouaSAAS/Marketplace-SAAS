/**
 * Attributs propres à une catégorie d'annonce (`categories.attribute_schema`),
 * stockés dans `listings.attributes`. Ce registre sert à l'AFFICHAGE : seuls
 * les attributs connus et du bon type sont montrés ; rien n'est déduit ni
 * complété. La validation à la saisie arrive avec la publication (niveau 18).
 */

type AttributeKind =
  | { kind: "text" }
  | { kind: "integer"; unit?: string }
  | { kind: "boolean" }
  | { kind: "date" }
  | { kind: "choice"; options: Record<string, string> };

interface AttributeDefinition {
  label: string;
  type: AttributeKind;
}

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
    meuble: { label: "Meublé", type: { kind: "boolean" } },
  },
  emploi: {
    contrat: {
      label: "Contrat",
      type: {
        kind: "choice",
        options: { cdi: "CDI", cdd: "CDD", stage: "Stage", interim: "Intérim", freelance: "Indépendant", temps_partiel: "Temps partiel" },
      },
    },
    secteur: { label: "Secteur", type: { kind: "text" } },
    experience: { label: "Expérience demandée", type: { kind: "text" } },
    date_limite: { label: "Date limite de candidature", type: { kind: "date" } },
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
    boite: { label: "Boîte de vitesses", type: { kind: "choice", options: { manuelle: "Manuelle", automatique: "Automatique" } } },
  },
  bien: {
    etat: {
      label: "État",
      type: {
        kind: "choice",
        options: { neuf: "Neuf", tres_bon: "Très bon état", bon: "Bon état", correct: "État correct", pour_pieces: "Pour pièces" },
      },
    },
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
