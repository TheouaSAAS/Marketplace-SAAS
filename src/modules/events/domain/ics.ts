/**
 * Fichier d'agenda (iCalendar) d'un événement : la personne l'ajoute à son
 * agenda et y règle ses propres rappels. Aucune donnée personnelle.
 */

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lignes de 75 caractères au plus (RFC 5545), repliées par une espace en tête. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

export function eventIcs(event: {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  url: string;
  cancelled: boolean;
  now: Date;
}): string {
  // Sans heure de fin connue : deux heures, mention faite dans la description.
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 3_600_000);
  const note = event.endsAt ? "" : "\n(Heure de fin non communiquée.)";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Carrefour des Possibles//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@carrefour-des-possibles`,
    `DTSTAMP:${stamp(event.now)}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(`${event.description.slice(0, 500)}${note}\n${event.url}`)}`,
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []),
    `URL:${event.url}`,
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
