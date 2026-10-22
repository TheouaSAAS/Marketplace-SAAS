/**
 * Fraîcheur d'une annonce immobilière : la disponibilité est déclarative. Une
 * annonce publiée ou confirmée par l'annonceur il y a plus de 30 jours est
 * signalée « à reconfirmer » (le bien a pu partir).
 */
export const CONFIRMATION_DAYS = 30;

const DAY = 86_400_000;

export type Freshness = { status: "recent"; days: number } | { status: "stale"; days: number } | { status: "unknown" };

export function confirmationFreshness(lastConfirmedAt: string | null, publishedAt: string | null, now: Date): Freshness {
  const reference = lastConfirmedAt ?? publishedAt;
  if (!reference) return { status: "unknown" };
  const time = new Date(reference).getTime();
  if (Number.isNaN(time)) return { status: "unknown" };
  const days = Math.max(0, Math.floor((now.getTime() - time) / DAY));
  return { status: days > CONFIRMATION_DAYS ? "stale" : "recent", days };
}

export function freshnessLabel(freshness: Freshness, confirmed: boolean): string {
  if (freshness.status === "unknown") return "Date de confirmation inconnue";
  const when = freshness.days === 0 ? "aujourd’hui" : freshness.days === 1 ? "hier" : `il y a ${freshness.days} jours`;
  if (freshness.status === "stale") return `À reconfirmer : ${confirmed ? "confirmée" : "publiée"} ${when}`;
  return `${confirmed ? "Confirmée" : "Publiée"} ${when}`;
}
