import { z } from "zod";

/**
 * Réponses du parcours « Nouveau à San Pedro ? ». Uniquement des choix
 * catégoriels (aucune donnée personnelle, aucun montant) : elles peuvent
 * voyager dans l'adresse du plan et être partagées sans risque.
 */

export const PURPOSES = {
  travailler: "Travailler",
  etudier: "Étudier",
  visiter: "Visiter",
  s_installer: "M’installer",
  entreprendre: "Entreprendre",
  autre: "Autre raison",
} as const;

export const DURATIONS = {
  quelques_jours: "Quelques jours",
  quelques_semaines: "Quelques semaines",
  quelques_mois: "Quelques mois",
  longue_duree: "Longue durée",
} as const;

/** Budget indicatif, volontairement sans montant : aucune estimation de prix n'est faite. */
export const BUDGETS = {
  serre: "Serré",
  moyen: "Moyen",
  confortable: "Confortable",
  non_precise: "Je préfère ne pas préciser",
} as const;

export const HOUSING = {
  aucun: "Je suis déjà logé",
  hebergement_court: "Hôtel ou hébergement court",
  location: "Location",
  colocation: "Colocation",
  achat: "Achat",
  non_precise: "Je ne sais pas encore",
} as const;

export const MOBILITY = {
  a_pied: "À pied",
  deux_roues: "Deux-roues",
  voiture: "Voiture",
  taxi: "Taxi et transports",
  non_precise: "Je ne sais pas encore",
} as const;

export const PRIORITIES = {
  logement: "Me loger",
  emploi: "Trouver un emploi",
  transport: "Me déplacer",
  courses: "Faire mes courses",
  sante: "Santé",
  ecoles: "Écoles et formation",
  demarches: "Services essentiels",
  sorties: "Sorties et loisirs",
  tourisme: "Tourisme",
  reseau_pro: "Contacts professionnels",
} as const;

export const INTERESTS = {
  plage: "Plages et nature",
  gastronomie: "Gastronomie",
  culture: "Culture et traditions",
  sport: "Sport",
  vie_nocturne: "Sorties du soir",
  famille: "Activités en famille",
} as const;

const keys = <T extends Record<string, string>>(record: T) => Object.keys(record) as [keyof T & string, ...(keyof T & string)[]];

export const MAX_PRIORITIES = 4;

export const answersSchema = z.object({
  purpose: z.enum(keys(PURPOSES), { error: "Choisissez ce qui vous amène." }),
  purposeOther: z.string().trim().max(120, "120 caractères au maximum.").optional(),
  duration: z.enum(keys(DURATIONS), { error: "Indiquez la durée prévue." }),
  budget: z.enum(keys(BUDGETS)).default("non_precise"),
  housing: z.enum(keys(HOUSING), { error: "Indiquez votre situation de logement." }),
  mobility: z.enum(keys(MOBILITY)).default("non_precise"),
  priorities: z
    .array(z.enum(keys(PRIORITIES)))
    .max(MAX_PRIORITIES, `Choisissez au plus ${MAX_PRIORITIES} priorités.`)
    .default([]),
  interests: z.array(z.enum(keys(INTERESTS))).default([]),
});

export type NewcomerAnswers = z.infer<typeof answersSchema>;

/** Version du modèle de réponses (stockée avec un parcours enregistré). */
export const ANSWERS_VERSION = 1;

/* ------------------------------------------------------------------------- */
/* Passage par l'adresse : ?motif=…&duree=…&logement=…&priorites=a,b         */
/* ------------------------------------------------------------------------- */

const PARAM_NAMES = {
  purpose: "motif",
  purposeOther: "precision",
  duration: "duree",
  budget: "budget",
  housing: "logement",
  mobility: "mobilite",
  priorities: "priorites",
  interests: "interets",
} as const;

export function answersToSearchParams(answers: NewcomerAnswers): URLSearchParams {
  const params = new URLSearchParams();
  params.set(PARAM_NAMES.purpose, answers.purpose);
  if (answers.purpose === "autre" && answers.purposeOther) params.set(PARAM_NAMES.purposeOther, answers.purposeOther);
  params.set(PARAM_NAMES.duration, answers.duration);
  params.set(PARAM_NAMES.budget, answers.budget);
  params.set(PARAM_NAMES.housing, answers.housing);
  params.set(PARAM_NAMES.mobility, answers.mobility);
  if (answers.priorities.length) params.set(PARAM_NAMES.priorities, answers.priorities.join(","));
  if (answers.interests.length) params.set(PARAM_NAMES.interests, answers.interests.join(","));
  return params;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined): string[] {
  const raw = first(value);
  return raw ? [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))] : [];
}

/** Lit des réponses depuis l'adresse ; renvoie null si elles sont incomplètes ou invalides. */
export function answersFromSearchParams(params: RawParams): NewcomerAnswers | null {
  const result = answersSchema.safeParse({
    purpose: first(params[PARAM_NAMES.purpose]),
    purposeOther: first(params[PARAM_NAMES.purposeOther]),
    duration: first(params[PARAM_NAMES.duration]),
    budget: first(params[PARAM_NAMES.budget]) ?? undefined,
    housing: first(params[PARAM_NAMES.housing]),
    mobility: first(params[PARAM_NAMES.mobility]) ?? undefined,
    priorities: list(params[PARAM_NAMES.priorities]),
    interests: list(params[PARAM_NAMES.interests]),
  });
  return result.success ? result.data : null;
}
