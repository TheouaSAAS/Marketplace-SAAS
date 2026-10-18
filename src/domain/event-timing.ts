/**
 * Libellés temporels des événements, au fuseau d'Abidjan (UTC+0, sans heure
 * d'été). Fonctions pures : la date courante est toujours passée en paramètre.
 */

const TIME_ZONE = "Africa/Abidjan";

/** Jour calendaire « AAAA-MM-JJ » dans le fuseau local. */
function localDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dayDifference(from: Date, to: Date): number {
  return Math.round((Date.parse(localDay(to)) - Date.parse(localDay(from))) / 86_400_000);
}

export type EventMoment = "past" | "ongoing" | "today" | "tomorrow" | "weekend" | "week" | "later";

export function eventMoment(startsAt: Date, endsAt: Date | null, now: Date): EventMoment {
  if (startsAt.getTime() <= now.getTime()) {
    // Sans heure de fin connue, l'événement est considéré en cours jusqu'à la fin de sa journée.
    const finished = endsAt ? endsAt.getTime() < now.getTime() : dayDifference(startsAt, now) > 0;
    return finished ? "past" : "ongoing";
  }
  const days = dayDifference(now, startsAt);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  // Week-end à venir : samedi ou dimanche de la semaine en cours (0 = dimanche).
  const weekday = startsAt.getUTCDay();
  const daysToSunday = (7 - now.getUTCDay()) % 7;
  if ((weekday === 6 || weekday === 0) && days <= daysToSunday) return "weekend";
  if (days < 7) return "week";
  return "later";
}

export const EVENT_MOMENT_LABELS: Record<EventMoment, string> = {
  past: "Terminé",
  ongoing: "En cours",
  today: "Aujourd’hui",
  tomorrow: "Demain",
  weekend: "Ce week-end",
  week: "Cette semaine",
  later: "À venir",
};

export type ScheduleStatus = "scheduled" | "postponed" | "cancelled";

/** Un événement annulé ou passé n'est jamais présenté comme « à venir ». */
export function eventBadge(startsAt: Date, endsAt: Date | null, status: ScheduleStatus, now: Date): { label: string; tone: "info" | "warning" | "danger" | "neutral" } {
  if (status === "cancelled") return { label: "Annulé", tone: "danger" };
  const moment = eventMoment(startsAt, endsAt, now);
  if (moment === "past") return { label: EVENT_MOMENT_LABELS.past, tone: "neutral" };
  if (status === "postponed") return { label: `Reporté · ${EVENT_MOMENT_LABELS[moment]}`, tone: "warning" };
  return { label: EVENT_MOMENT_LABELS[moment], tone: "info" };
}
