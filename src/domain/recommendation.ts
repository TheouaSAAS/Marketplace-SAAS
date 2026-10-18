import { displayedVerification, type VerificationStatus } from "./verification";

/**
 * Règles de mise en avant de l'accueil : déterministes, explicables, sans
 * paiement ni profilage. Chaque section affiche sa règle en clair.
 */

export interface RankablePlace {
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  updatedAt: string;
}

const VERIFICATION_RANK: Record<VerificationStatus, number> = {
  verified: 0,
  pending_validation: 1,
  placeholder: 2,
  archived: 3,
  rejected: 3,
};

/** Lieux : d'abord ceux dont la vérification est en cours de validité, puis les plus récemment mis à jour. */
export function rankPlaces<T extends RankablePlace>(places: readonly T[], now: Date): T[] {
  return [...places].sort((a, b) => {
    const rankA = VERIFICATION_RANK[displayedVerification(a.verificationStatus, a.verifiedAt, now)];
    const rankB = VERIFICATION_RANK[displayedVerification(b.verificationStatus, b.verifiedAt, now)];
    if (rankA !== rankB) return rankA - rankB;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

export const RECOMMENDATION_RULES = {
  listings: "Les annonces publiées les plus récentes de la ville, de la plus récente à la plus ancienne. Aucune annonce n’est mise en avant contre paiement.",
  places: "Les lieux publiés de la ville : d’abord ceux dont la vérification est à jour, puis les plus récemment mis à jour.",
  events: "Les prochains événements de la ville, du plus proche au plus lointain. Les événements passés n’apparaissent pas ; les annulations restent signalées.",
  professionals: "Les commerces et prestataires publiés de la ville, selon la même règle que les lieux : vérification à jour d’abord.",
} as const;
