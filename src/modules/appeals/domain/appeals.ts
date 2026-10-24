/** Recours contre une décision de modération (niveau 26) : toujours tranchés par une personne. */
export const APPEAL_TARGETS = {
  listing: "Annonce",
  place: "Vitrine ou lieu",
  event: "Événement",
  business: "Page professionnelle",
  comment: "Commentaire",
  review: "Avis",
  account: "Compte",
} as const;
export type AppealTarget = keyof typeof APPEAL_TARGETS;
export const APPEAL_TARGET_KEYS = Object.keys(APPEAL_TARGETS) as [AppealTarget, ...AppealTarget[]];

export const APPEAL_STATUSES = {
  pending: { label: "Recours en cours d’examen", tone: "warning" },
  accepted: { label: "Recours accepté", tone: "success" },
  rejected: { label: "Recours refusé", tone: "neutral" },
} as const;
export type AppealStatus = keyof typeof APPEAL_STATUSES;

export interface MyAppeal {
  targetType: AppealTarget;
  targetId: string;
  status: AppealStatus;
  decisionNote: string | null;
}

/** Dernier recours déposé pour un contenu (liste triée du plus récent au plus ancien). */
export function latestAppeal(appeals: readonly MyAppeal[], type: AppealTarget, id: string): MyAppeal | null {
  return appeals.find((appeal) => appeal.targetType === type && appeal.targetId === id) ?? null;
}
