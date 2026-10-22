import { formatDistance } from "@/modules/search/domain/position";
import { AVAILABLE_DAYS } from "./params";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Abidjan" });
const DAY = 86_400_000;

/** Disponibilité telle que déclarée, toujours datée ; ancienne déclaration signalée. */
export function availabilityText(note: string | null, declaredAt: string | null, now: Date): string | null {
  if (!note || !declaredAt) return null;
  const date = new Date(declaredAt);
  const old = now.getTime() - date.getTime() > AVAILABLE_DAYS * DAY;
  return `${old ? "Déclaration ancienne" : "Déclaré"} le ${DATE.format(date)} : « ${note} »`;
}

/** Ligne de contexte d'un résultat : devis, distance (position publique, souvent approximative). */
export function proContext(pro: { accepts_quotes: boolean; distanceM?: number | null }): string {
  return ["Professionnel", pro.accepts_quotes ? "devis en ligne" : null, pro.distanceM != null ? formatDistance(pro.distanceM, true) : null]
    .filter(Boolean)
    .join(" · ");
}
