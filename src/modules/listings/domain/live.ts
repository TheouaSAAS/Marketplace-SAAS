/**
 * Rythme des rechargements « en direct » : on regroupe les changements reçus
 * en rafale (un lot d'annonces validées d'un coup) et on espace les
 * rechargements pour ne pas surcharger le serveur ni gêner la lecture.
 */
export const LIVE_DEBOUNCE_MS = 1_500;
export const LIVE_MIN_GAP_MS = 10_000;

/** Délai avant le prochain rechargement, sachant que le dernier a eu lieu à `last`. */
export function nextRefreshDelay(last: number, now: number): number {
  return Math.max(LIVE_DEBOUNCE_MS, last + LIVE_MIN_GAP_MS - now);
}
