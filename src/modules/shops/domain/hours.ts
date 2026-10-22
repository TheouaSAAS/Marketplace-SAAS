/**
 * Horaires d'une vitrine. Ils ne sont présentés comme fiables que s'ils ont
 * été vérifiés par l'équipe locale, avec une source, depuis moins de 180 jours
 * (VERIFICATION_VALIDITY_DAYS.opening_hours) ; sinon « à confirmer ».
 * San Pedro est à l'heure UTC (Africa/Abidjan), sans changement d'heure.
 */
import { z } from "zod";
import { VERIFICATION_VALIDITY_DAYS } from "@/domain/verification";

export const WEEK_DAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const DAY_LABELS: Record<WeekDay, string> = {
  lun: "Lundi",
  mar: "Mardi",
  mer: "Mercredi",
  jeu: "Jeudi",
  ven: "Vendredi",
  sam: "Samedi",
  dim: "Dimanche",
};

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const slot = z.tuple([time, time]).refine(([start, end]) => end > start);
const hoursSchema = z.partialRecord(z.enum(WEEK_DAYS), z.array(slot).max(4));

export type OpeningHours = z.infer<typeof hoursSchema>;

/** Horaires lus avec prudence (colonne JSON) : format inattendu → aucun horaire. */
export function parseOpeningHours(value: unknown): OpeningHours | null {
  const parsed = hoursSchema.safeParse(value);
  return parsed.success && Object.keys(parsed.data).length > 0 ? parsed.data : null;
}

export type HoursStatus =
  | { kind: "missing" }
  | { kind: "verified"; verifiedAt: string; source: string | null }
  | { kind: "unconfirmed"; reason: "never" | "expired" };

export function hoursStatus(hours: OpeningHours | null, verifiedAt: string | null, source: string | null, now: Date): HoursStatus {
  if (!hours) return { kind: "missing" };
  if (!verifiedAt) return { kind: "unconfirmed", reason: "never" };
  const age = (now.getTime() - new Date(verifiedAt).getTime()) / 86_400_000;
  if (!(age >= 0 && age <= VERIFICATION_VALIDITY_DAYS.opening_hours)) return { kind: "unconfirmed", reason: "expired" };
  return { kind: "verified", verifiedAt, source };
}

function dayOf(date: Date): WeekDay {
  return WEEK_DAYS[(date.getUTCDay() + 6) % 7]!;
}

function minutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h! * 60 + m!;
}

/** Ouvert à cet instant d'après les horaires donnés (qu'ils soient vérifiés ou non : l'affichage le précise). */
export function isOpenAt(hours: OpeningHours, date: Date): boolean {
  const now = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (hours[dayOf(date)] ?? []).some(([start, end]) => now >= minutes(start) && now < minutes(end));
}

/** Semaine lisible, du lundi au dimanche ; un jour absent est « non renseigné », un jour vide « fermé ». */
export function weekLines(hours: OpeningHours): { day: WeekDay; label: string; text: string }[] {
  return WEEK_DAYS.map((day) => {
    const slots = hours[day];
    const text = slots === undefined ? "Non renseigné" : slots.length === 0 ? "Fermé" : slots.map(([start, end]) => `${start} – ${end}`).join(", ");
    return { day, label: DAY_LABELS[day], text };
  });
}
