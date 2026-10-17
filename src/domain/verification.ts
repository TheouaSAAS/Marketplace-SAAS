/**
 * Statut de vérification des DONNÉES LOCALES (docs/data-governance.md).
 * Distinct du statut de modération (content-status.ts) : une annonce publiée
 * n'est pas pour autant une information vérifiée par l'équipe.
 * Valeurs identiques à l'enum SQL `public.verification_status` (niveau 2).
 */
export const VERIFICATION_STATUSES = ["verified", "pending_validation", "placeholder", "archived", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type VerificationTone = "verified" | "pending" | "placeholder" | "neutral" | "danger";

export const VERIFICATION_META: Record<
  VerificationStatus,
  { label: string; tone: VerificationTone; publicNote: string; showToPublic: boolean }
> = {
  verified: {
    label: "Vérifié",
    tone: "verified",
    publicNote: "Information contrôlée par l’équipe locale.",
    showToPublic: true,
  },
  pending_validation: {
    label: "À vérifier",
    tone: "pending",
    publicNote: "Information à confirmer localement.",
    showToPublic: true,
  },
  placeholder: {
    label: "Exemple",
    tone: "placeholder",
    publicNote: "Exemple de démonstration, à valider localement : ne pas s’y fier.",
    showToPublic: false,
  },
  archived: { label: "Archivé", tone: "neutral", publicNote: "Information plus d’actualité.", showToPublic: false },
  rejected: { label: "Refusé", tone: "danger", publicNote: "Information refusée au contrôle.", showToPublic: false },
};

/** Durées de validité d'une vérification, en jours, par type d'information. */
export const VERIFICATION_VALIDITY_DAYS = {
  default: 365,
  opening_hours: 180,
  prices: 90,
  contact: 365,
  event: 30,
} as const;

export type FreshnessKind = keyof typeof VERIFICATION_VALIDITY_DAYS;

/**
 * Une donnée n'est présentée comme fiable que si elle est vérifiée ET que sa
 * vérification n'a pas dépassé sa durée de validité.
 */
export function isReliable(
  status: VerificationStatus,
  verifiedAt: Date | string | null | undefined,
  now: Date,
  kind: FreshnessKind = "default",
): boolean {
  if (status !== "verified" || !verifiedAt) return false;
  const verified = typeof verifiedAt === "string" ? new Date(verifiedAt) : verifiedAt;
  if (Number.isNaN(verified.getTime()) || verified.getTime() > now.getTime()) return false;
  const ageDays = (now.getTime() - verified.getTime()) / 86_400_000;
  return ageDays <= VERIFICATION_VALIDITY_DAYS[kind];
}

/** Statut à afficher au public : une vérification expirée redevient « à vérifier ». */
export function displayedVerification(
  status: VerificationStatus,
  verifiedAt: Date | string | null | undefined,
  now: Date,
  kind: FreshnessKind = "default",
): VerificationStatus {
  if (status === "verified" && !isReliable(status, verifiedAt, now, kind)) return "pending_validation";
  return status;
}
