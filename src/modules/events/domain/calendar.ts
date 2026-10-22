/**
 * Calendrier mensuel (lundi en premier), au fuseau de San Pedro (UTC toute
 * l'année). Fonctions pures : la date courante est passée en paramètre.
 */

export interface CalendarDay {
  /** « AAAA-MM-JJ » */
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");
export const dayKey = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
export const monthKey = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;

/** Premier jour du mois « AAAA-MM » (mois courant si absent). */
export function monthStart(month: string | null, now: Date): Date {
  if (month) {
    const [year, value] = month.split("-").map(Number);
    return new Date(Date.UTC(year!, value! - 1, 1));
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function shiftMonth(start: Date, delta: number): Date {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1));
}

/** Semaines complètes (lundi → dimanche) couvrant le mois. */
export function monthGrid(start: Date, now: Date): CalendarDay[][] {
  const today = dayKey(now);
  const offset = (start.getUTCDay() + 6) % 7; // 0 = lundi
  let cursor = new Date(start.getTime() - offset * 86_400_000);
  const weeks: CalendarDay[][] = [];
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const key = dayKey(cursor);
      week.push({ key, day: cursor.getUTCDate(), inMonth: cursor.getUTCMonth() === start.getUTCMonth(), isToday: key === today, isPast: key < today });
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    weeks.push(week);
  } while (cursor.getUTCMonth() === start.getUTCMonth());
  return weeks;
}
