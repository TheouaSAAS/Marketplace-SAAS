/**
 * Valeurs des attributs d'une offre (`listings.attributes`, schéma « emploi »).
 * Listes fermées : les filtres et l'affichage n'acceptent que ces clés.
 */

export const CONTRACTS = {
  cdi: "CDI",
  cdd: "CDD",
  stage: "Stage",
  interim: "Intérim",
  freelance: "Mission ou freelance",
  temps_partiel: "Temps partiel",
  apprentissage: "Apprentissage",
} as const;

export const DOMAINS = {
  administration: "Administration et gestion",
  agriculture: "Agriculture et agro-industrie",
  btp: "Bâtiment et travaux publics",
  commerce: "Commerce et vente",
  education: "Éducation et formation",
  finance: "Finance et comptabilité",
  hotellerie: "Hôtellerie et restauration",
  industrie: "Industrie",
  informatique: "Informatique et numérique",
  logistique: "Logistique, port et transport",
  sante: "Santé et social",
  autre: "Autre domaine",
} as const;

export const EXPERIENCE = {
  debutant: "Débutant accepté",
  un_trois: "1 à 3 ans",
  trois_cinq: "3 à 5 ans",
  cinq_plus: "Plus de 5 ans",
} as const;

export const REMOTE = { non: "Sur place", partiel: "Télétravail partiel", total: "Télétravail complet" } as const;

export const ORGANIZATIONS = {
  entreprise: "Entreprise",
  association: "Association ou ONG",
  administration: "Administration",
  particulier: "Particulier",
} as const;

export const APPLY_MODES = { interne: "Candidature sur la plateforme", externe: "Candidature sur le site de l’employeur" } as const;

export type Contract = keyof typeof CONTRACTS;
export type Domain = keyof typeof DOMAINS;
export type Experience = keyof typeof EXPERIENCE;
export type Remote = keyof typeof REMOTE;
export type Organization = keyof typeof ORGANIZATIONS;
export type ApplyMode = keyof typeof APPLY_MODES;

/** Catégories de l'espace emploi et opportunités (référentiel administrable). */
export const JOB_TYPES = {
  "offres-emploi": "Offres d’emploi",
  stages: "Stages",
  "missions-freelance": "Missions et freelance",
  "demandes-emploi": "Compétences disponibles",
  formation: "Formations",
  "appels-offres": "Appels à prestataires",
  "opportunites-commerciales": "Opportunités commerciales",
} as const;
export type JobType = keyof typeof JOB_TYPES;

/** Lien de candidature externe : https seulement, adresse affichée en clair avant de quitter le site. */
export function safeApplyLink(value: unknown): { href: string; host: string } | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) return null;
    return { href: url.toString(), host: url.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}
