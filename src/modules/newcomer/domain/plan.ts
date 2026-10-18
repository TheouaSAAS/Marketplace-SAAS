import type { RouteKey } from "@/config/routes";
import { BUDGETS, DURATIONS, HOUSING, INTERESTS, MOBILITY, PRIORITIES, PURPOSES, type NewcomerAnswers } from "./answers";

/**
 * Construction du plan personnalisé : règles DÉTERMINISTES, sans IA, sans
 * estimation de prix ni conseil juridique, financier, médical ou de sécurité.
 * Chaque bloc conserve les raisons qui l'ont fait apparaître (transparence).
 * Le contenu de chaque bloc vient de la base (annonces, lieux, événements,
 * quartiers) : un bloc sans contenu affiche un état vide explicite.
 */

export type BlockKey =
  | "hebergement"
  | "logement"
  | "achat"
  | "quartiers"
  | "emploi"
  | "transport"
  | "courses"
  | "sante"
  | "ecoles"
  | "demarches"
  | "sorties"
  | "tourisme"
  | "restaurants"
  | "evenements"
  | "reseau_pro"
  | "opportunites"
  | "locaux_pro";

export type BlockContent =
  | { kind: "listings"; categories: readonly string[] }
  | { kind: "places"; categories: readonly string[] }
  | { kind: "events" }
  | { kind: "neighborhoods" }
  | { kind: "none" };

export interface BlockAction {
  label: string;
  route: RouteKey;
  category?: string;
}

export interface BlockDefinition {
  title: string;
  description: string;
  content: BlockContent;
  actions: readonly BlockAction[];
}

export const BLOCKS: Record<BlockKey, BlockDefinition> = {
  hebergement: {
    title: "Où dormir",
    description: "Hôtels et hébergements de courte durée.",
    content: { kind: "places", categories: ["hotels-hebergements"] },
    actions: [{ label: "Voir les hébergements", route: "tourism", category: "hotels-hebergements" }],
  },
  logement: {
    title: "Trouver un logement",
    description: "Locations et colocations publiées par des particuliers et des professionnels.",
    content: { kind: "listings", categories: ["immobilier-location"] },
    actions: [
      { label: "Annonces de location", route: "realEstate", category: "immobilier-location" },
      { label: "Conseils pour se loger", route: "guide" },
    ],
  },
  achat: {
    title: "Acheter un bien ou un terrain",
    description: "Biens et terrains à vendre.",
    content: { kind: "listings", categories: ["immobilier-vente", "terrains"] },
    actions: [{ label: "Annonces de vente", route: "realEstate", category: "immobilier-vente" }],
  },
  quartiers: {
    title: "Choisir son quartier",
    description: "Les quartiers et ce que la plateforme y recense réellement — sans classement « meilleur » ni « sûr ».",
    content: { kind: "neighborhoods" },
    actions: [{ label: "Explorer les quartiers", route: "neighborhoods" }],
  },
  emploi: {
    title: "Trouver un emploi",
    description: "Offres d’emploi, stages et missions.",
    content: { kind: "listings", categories: ["offres-emploi", "stages"] },
    actions: [{ label: "Offres d’emploi", route: "jobs" }],
  },
  transport: {
    title: "Se déplacer",
    description: "Transport, livraison et repères pour circuler en ville.",
    content: { kind: "places", categories: ["transport-livraison"] },
    actions: [
      { label: "Guide : se déplacer", route: "guide" },
      { label: "Transport et livraison", route: "services", category: "transport-livraison" },
    ],
  },
  courses: {
    title: "Faire ses courses",
    description: "Alimentation et commerces de proximité.",
    content: { kind: "places", categories: ["alimentation", "commerces-boutiques"] },
    actions: [{ label: "Commerces de proximité", route: "shops" }],
  },
  sante: {
    title: "Santé",
    description: "Professionnels et établissements de santé recensés.",
    content: { kind: "places", categories: ["sante"] },
    actions: [{ label: "Services de santé", route: "services", category: "sante" }],
  },
  ecoles: {
    title: "Écoles et formation",
    description: "Formations et établissements recensés.",
    content: { kind: "listings", categories: ["formation"] },
    actions: [{ label: "Formations", route: "listings", category: "formation" }],
  },
  demarches: {
    title: "Services essentiels",
    description: "Banques, télécommunications, services utiles au quotidien : repères du guide pratique.",
    content: { kind: "none" },
    actions: [{ label: "Guide pratique", route: "guide" }],
  },
  sorties: {
    title: "Sorties et loisirs",
    description: "Activités et loisirs à proximité.",
    content: { kind: "places", categories: ["loisirs-activites"] },
    actions: [{ label: "Loisirs et activités", route: "discover", category: "loisirs-activites" }],
  },
  tourisme: {
    title: "Découvrir la région",
    description: "Lieux à visiter, plages et sites naturels.",
    content: { kind: "places", categories: ["lieux-a-visiter", "plages-sites-naturels"] },
    actions: [{ label: "Tourisme", route: "tourism" }],
  },
  restaurants: {
    title: "Où manger",
    description: "Restaurants et gastronomie.",
    content: { kind: "places", categories: ["restaurants-gastronomie"] },
    actions: [{ label: "Restaurants", route: "discover", category: "restaurants-gastronomie" }],
  },
  evenements: {
    title: "Que faire ces prochains jours",
    description: "Les prochains événements de la ville.",
    content: { kind: "events" },
    actions: [{ label: "Tous les événements", route: "events" }],
  },
  reseau_pro: {
    title: "Contacts professionnels",
    description: "Entreprises, prestataires et services aux entreprises.",
    content: { kind: "places", categories: ["services-aux-entreprises"] },
    actions: [{ label: "Professionnels et entreprises", route: "directory" }],
  },
  opportunites: {
    title: "Opportunités d’affaires",
    description: "Opportunités commerciales et appels d’offres publiés.",
    content: { kind: "listings", categories: ["opportunites-commerciales", "appels-offres"] },
    actions: [{ label: "Opportunités", route: "jobs", category: "opportunites-commerciales" }],
  },
  locaux_pro: {
    title: "Bureaux et locaux",
    description: "Locaux professionnels à louer ou à vendre.",
    content: { kind: "listings", categories: ["locaux-professionnels"] },
    actions: [{ label: "Locaux professionnels", route: "realEstate", category: "locaux-professionnels" }],
  },
};

export interface PlanBlock {
  key: BlockKey;
  reasons: string[];
  /** Remarque contextuelle (jamais un conseil financier ou de sécurité). */
  note?: string;
}

export interface NewcomerPlan {
  blocks: PlanBlock[];
  summary: string[];
}

export const MAX_BLOCKS = 8;

const BASE_BY_PURPOSE: Record<NewcomerAnswers["purpose"], BlockKey[]> = {
  visiter: ["hebergement", "tourisme", "restaurants", "evenements", "transport", "sorties"],
  travailler: ["logement", "transport", "courses", "sante", "sorties"],
  etudier: ["logement", "ecoles", "transport", "courses", "sorties"],
  s_installer: ["logement", "quartiers", "courses", "sante", "demarches", "transport", "sorties"],
  entreprendre: ["reseau_pro", "opportunites", "locaux_pro", "demarches", "logement", "transport"],
  autre: ["logement", "transport", "demarches", "sorties"],
};

const PRIORITY_BLOCK: Record<NewcomerAnswers["priorities"][number], BlockKey> = {
  logement: "logement",
  emploi: "emploi",
  transport: "transport",
  courses: "courses",
  sante: "sante",
  ecoles: "ecoles",
  demarches: "demarches",
  sorties: "sorties",
  tourisme: "tourisme",
  reseau_pro: "reseau_pro",
};

const INTEREST_BLOCKS: Record<NewcomerAnswers["interests"][number], BlockKey[]> = {
  plage: ["tourisme"],
  gastronomie: ["restaurants"],
  culture: ["evenements"],
  sport: ["sorties", "evenements"],
  vie_nocturne: ["sorties"],
  famille: ["sorties", "ecoles"],
};

const LODGING_BLOCKS: BlockKey[] = ["hebergement", "logement", "achat"];

/** Bloc de logement adapté à la situation et à la durée, ou null si la personne est déjà logée. */
function lodgingBlock(answers: NewcomerAnswers): { key: BlockKey; reason: string } | null {
  switch (answers.housing) {
    case "aucun":
      return null;
    case "hebergement_court":
      return { key: "hebergement", reason: "Vous cherchez un hébergement de courte durée." };
    case "achat":
      return { key: "achat", reason: "Vous envisagez un achat." };
    case "location":
    case "colocation":
      return { key: "logement", reason: `Vous cherchez une ${HOUSING[answers.housing].toLowerCase()}.` };
    case "non_precise":
      return answers.duration === "quelques_jours" || answers.duration === "quelques_semaines"
        ? { key: "hebergement", reason: `Pour un séjour de ${DURATIONS[answers.duration].toLowerCase()}, un hébergement court est le plus simple.` }
        : { key: "logement", reason: `Pour un séjour de ${DURATIONS[answers.duration].toLowerCase()}, une location est souvent plus adaptée.` };
  }
}

/** Blocs sans intérêt pour un séjour très court. */
const LONG_STAY_ONLY: BlockKey[] = ["quartiers", "demarches", "ecoles", "locaux_pro"];

export function buildPlan(answers: NewcomerAnswers): NewcomerPlan {
  const blocks = new Map<BlockKey, PlanBlock>();
  const add = (key: BlockKey, reason: string) => {
    const block = blocks.get(key) ?? { key, reasons: [] };
    if (!block.reasons.includes(reason)) block.reasons.push(reason);
    blocks.set(key, block);
  };

  const purposeReason =
    answers.purpose === "autre" && answers.purposeOther
      ? `Vous avez indiqué : « ${answers.purposeOther} ».`
      : `Vous venez pour : ${PURPOSES[answers.purpose].toLowerCase()}.`;
  const lodging = lodgingBlock(answers);
  const shortStay = answers.duration === "quelques_jours";

  // 1. Base selon le motif, avec le logement adapté à la situation.
  for (const key of BASE_BY_PURPOSE[answers.purpose]) {
    if (LODGING_BLOCKS.includes(key)) {
      if (lodging) add(lodging.key, lodging.reason);
      continue;
    }
    if (shortStay && LONG_STAY_ONLY.includes(key)) continue;
    add(key, purposeReason);
  }

  // 2. Priorités déclarées : ajoutées si absentes, puis placées en tête.
  const priorityKeys: BlockKey[] = [];
  for (const priority of answers.priorities) {
    let key = PRIORITY_BLOCK[priority];
    if (key === "logement") {
      if (!lodging) continue;
      key = lodging.key;
    }
    add(key, `Vous avez choisi « ${PRIORITIES[priority]} » parmi vos priorités.`);
    priorityKeys.push(key);
  }

  // 3. Centres d'intérêt : complètent le plan.
  for (const interest of answers.interests) {
    for (const key of INTEREST_BLOCKS[interest]) {
      if (shortStay && LONG_STAY_ONLY.includes(key)) continue;
      add(key, `Vous aimez : ${INTERESTS[interest].toLowerCase()}.`);
    }
  }

  // Notes contextuelles, sans estimation de prix ni conseil.
  for (const key of ["logement", "achat", "hebergement"] as const) {
    const block = blocks.get(key);
    if (block && answers.budget !== "non_precise") {
      block.note = `Budget indiqué : ${BUDGETS[answers.budget].toLowerCase()}. Nous n’estimons aucun prix : chaque annonce affiche le sien, à vérifier auprès de l’annonceur.`;
    }
  }
  const transport = blocks.get("transport");
  if (transport && answers.mobility !== "non_precise") {
    transport.reasons.push(`Vous prévoyez de vous déplacer : ${MOBILITY[answers.mobility].toLowerCase()}.`);
  }

  // Ordre : priorités (dans l'ordre choisi), puis le reste dans l'ordre d'ajout.
  const ordered = [
    ...priorityKeys.filter((key, index) => priorityKeys.indexOf(key) === index),
    ...[...blocks.keys()].filter((key) => !priorityKeys.includes(key)),
  ].map((key) => blocks.get(key)!);

  return {
    blocks: ordered.slice(0, MAX_BLOCKS),
    summary: [
      answers.purpose === "autre" && answers.purposeOther ? answers.purposeOther : PURPOSES[answers.purpose],
      DURATIONS[answers.duration],
      HOUSING[answers.housing],
      ...(answers.budget !== "non_precise" ? [`Budget ${BUDGETS[answers.budget].toLowerCase()}`] : []),
    ],
  };
}
