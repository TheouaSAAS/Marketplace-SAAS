import type { SearchWhen } from "./params";

/**
 * Périodes des filtres de date. San Pedro est à l'heure UTC toute l'année
 * (Africa/Abidjan, sans heure d'été) : les jours sont calculés en UTC.
 * Une période est l'intervalle [début, fin[.
 */

const DAY = 86_400_000;

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function whenRange(when: SearchWhen, now: Date): { from: Date; to: Date } {
  const today = startOfDay(now);
  const plus = (days: number) => new Date(today.getTime() + days * DAY);
  switch (when) {
    case "aujourdhui":
      return { from: now, to: plus(1) };
    case "demain":
      return { from: plus(1), to: plus(2) };
    case "weekend": {
      // Samedi et dimanche ; un week-end en cours commence maintenant.
      const weekday = today.getUTCDay(); // 0 = dimanche, 6 = samedi
      if (weekday === 6 || weekday === 0) return { from: now, to: plus(weekday === 6 ? 2 : 1) };
      const saturday = plus(6 - weekday);
      return { from: saturday, to: new Date(saturday.getTime() + 2 * DAY) };
    }
    case "semaine":
      return { from: now, to: plus(7) };
    case "mois":
      return { from: now, to: plus(30) };
  }
}
