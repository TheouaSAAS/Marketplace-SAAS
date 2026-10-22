/** Lien déclaré avec le commerce revendiqué (clés identiques à la contrainte SQL de place_claims). */
export const CLAIMANT_ROLES = {
  proprietaire: "Propriétaire",
  gerant: "Gérant ou gérante",
  salarie: "Salarié mandaté",
} as const;
export type ClaimantRole = keyof typeof CLAIMANT_ROLES;

export const CLAIM_STATUSES = {
  pending: "En attente",
  approved: "Validée",
  rejected: "Refusée",
} as const;
export type ClaimStatus = keyof typeof CLAIM_STATUSES;

/** Ce que l'équipe vérifie avant de valider (affiché au demandeur). */
export const CLAIM_EVIDENCE_HINT =
  "Un élément que l’équipe peut vérifier : numéro au registre du commerce (RCCM), facture d’eau ou d’électricité au nom du commerce, carte professionnelle…";
