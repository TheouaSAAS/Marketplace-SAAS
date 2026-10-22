import { connection } from "next/server";
import { href } from "@/config/routes";
import { publicEnv } from "@/lib/env";
import { eventIcs } from "@/modules/events/domain/ics";
import { getPublicEvent } from "@/modules/events/server/detail";

/** Fichier d'agenda d'un événement publié : la personne y règle ses propres rappels. */
export async function GET(_request: Request, { params }: RouteContext<"/evenements/[slug]/agenda.ics">) {
  await connection();
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) return new Response("Événement introuvable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const body = eventIcs({
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: new Date(event.starts_at),
    endsAt: event.ends_at ? new Date(event.ends_at) : null,
    location: [event.place?.name ?? event.address_text, event.neighborhood?.name, "San Pedro"].filter(Boolean).join(", "),
    url: `${publicEnv.NEXT_PUBLIC_SITE_URL}${href("eventDetail", { params: { slug } })}`,
    cancelled: event.schedule_status === "cancelled",
    now: new Date(),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
