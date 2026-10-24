import type { Metadata } from "next";
import { LAUNCH_CITY } from "@/domain/city";
import { JsonLd } from "@/components/layout/json-ld";
import { detailMetadata, eventJsonLd } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarPlus, Clock, MapPin, Navigation, Ticket } from "lucide-react";
import { href } from "@/config/routes";
import { eventBadge, eventMoment } from "@/domain/event-timing";
import { displayedVerification } from "@/domain/verification";
import { publicEnv } from "@/lib/env";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { VerificationBadge } from "@/components/ui/verification";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ShareButton, WhatsAppShareLink } from "@/modules/listings/components/listing-buttons";
import { ListingMap } from "@/modules/listings/components/listing-map";
import { ReportForm } from "@/modules/listings/components/report-form";
import { contactLink } from "@/modules/listings/domain/presentation";
import { TO_CONFIRM } from "@/modules/tourism/domain/attributes";
import { EventFavoriteButton, OrganizerMessageForm } from "@/modules/events/components/event-forms";
import { getEventPoint, getPublicEvent, isFavoriteEvent, type EventDetail } from "@/modules/events/server/detail";
import { getSessionUser } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";

type Props = PageProps<"/evenements/[slug]">;

const WHEN = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const HOUR = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) return { title: "Événement", robots: { index: false, follow: true } };
  return detailMetadata({ title: event.title, description: event.description, path: href("eventDetail", { params: { slug } }), noindex: event.verification_status === "placeholder" });
}

function price(event: EventDetail): string {
  if (event.is_free) return "Gratuit";
  if (event.price_min !== null && event.price_max !== null && event.price_max !== event.price_min)
    return `${formatPrice(event.price_min, "total")} à ${formatPrice(event.price_max, "total")}`;
  if (event.price_min !== null) return formatPrice(event.price_min, "a_partir_de");
  return `Tarif : ${TO_CONFIRM.toLowerCase()}`;
}

async function Engagement({ event, back }: { event: EventDetail; back: string }) {
  const user = await getSessionUser();
  const favorite = user ? await isFavoriteEvent(event.id, user.id) : false;
  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}${back}`;
  return (
    <div className="flex flex-wrap gap-2">
      <EventFavoriteButton eventId={event.id} active={favorite} back={back} />
      <a
        href={`${back}/agenda.ics`}
        download
        className="inline-flex h-11 items-center gap-2 rounded-pill border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-sand-100"
      >
        <CalendarPlus aria-hidden className="h-4 w-4" />
        Ajouter à mon agenda
      </a>
      <ShareButton url={url} title={event.title} />
      <WhatsAppShareLink url={url} title={event.title} />
    </div>
  );
}

async function Location({ event }: { event: EventDetail }) {
  const point = await getEventPoint(event.id);
  const area = [event.place?.name ?? event.address_text, event.neighborhood?.name].filter(Boolean).join(", ");
  return (
    <section aria-labelledby="lieu" className="flex flex-col gap-2">
      <h2 id="lieu" className="text-xl font-bold">
        Lieu
      </h2>
      <p className="flex items-center gap-1.5 font-semibold">
        <MapPin aria-hidden className="h-4 w-4 text-brand-700" />
        {area || `Lieu : ${TO_CONFIRM.toLowerCase()}`}
      </p>
      {event.place && (
        <Link href={href("placeDetail", { params: { slug: event.place.slug } })} className="w-fit text-sm font-medium underline">
          Voir la fiche du lieu
        </Link>
      )}
      {point && isFeatureEnabled("map") && (
        <ListingMap
          lat={point.lat}
          lng={point.lng}
          radiusMeters={point.location_precision === "exact" ? null : 400}
          tileUrl={publicEnv.NEXT_PUBLIC_MAP_TILE_URL}
          attribution={publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION}
          label={`Carte : lieu de l’événement ${event.title}`}
        />
      )}
      {point?.location_precision === "exact" && (
        <a
          href={`https://www.openstreetmap.org/directions?to=${point.lat}%2C${point.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-pill border border-border-strong px-4 text-sm font-semibold hover:bg-sand-100"
        >
          <Navigation aria-hidden className="h-4 w-4" />
          Itinéraire (OpenStreetMap)
        </a>
      )}
    </section>
  );
}

async function EventView({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  // Statut temporel jugé à la date de la requête : jamais un événement passé présenté comme à venir.
  await connection();
  const now = new Date();
  const startsAt = new Date(event.starts_at);
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;
  const badge = eventBadge(startsAt, endsAt, event.schedule_status, now);
  const past = eventMoment(startsAt, endsAt, now) === "past";
  const back = href("eventDetail", { params: { slug } });
  const organizer = event.business ? (
    <Link href={href("professionalDetail", { params: { slug: event.business.slug } })} className="underline">
      {event.business.name}
    </Link>
  ) : (
    (event.organizer_name ?? "Organisateur non précisé")
  );

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Événements", href: href("events") }, { label: event.title }]} />
      <JsonLd
        data={eventJsonLd({
          title: event.title,
          description: event.description,
          path: back,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          schedule: event.schedule_status,
          originalStartsAt: event.original_starts_at,
          isFree: event.is_free,
          priceMin: event.price_min,
          ticketUrl: event.ticket_url,
          organizerName: event.business?.name ?? event.organizer_name,
          placeName: event.place?.name ?? null,
          address: event.address_text,
          neighborhood: event.neighborhood?.name ?? null,
          city: LAUNCH_CITY.name,
          verified: event.verification_status === "verified" && !past,
        })}
      />
      {event.verification_status === "placeholder" && (
        <Alert tone="warning" title="Exemple de démonstration">
          Cet événement est fictif et sert à tester la plateforme : il n’aura pas lieu.
        </Alert>
      )}
      {event.schedule_status === "cancelled" && (
        <Alert tone="danger" title="Événement annulé">
          {event.schedule_note}
        </Alert>
      )}
      {event.schedule_status === "postponed" && (
        <Alert tone="warning" title="Événement reporté">
          {event.original_starts_at ? `Initialement prévu le ${WHEN.format(new Date(event.original_starts_at))}. ` : ""}
          Nouvelle date : {WHEN.format(startsAt)}. {event.schedule_note}
        </Alert>
      )}
      {past && event.schedule_status !== "cancelled" && (
        <Alert tone="info" title="Événement terminé">
          Cette fiche reste consultable quelque temps, puis est archivée.
        </Alert>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={badge.tone}>{badge.label}</Badge>
              <VerificationBadge status={displayedVerification(event.verification_status, event.verified_at, now, "event")} />
              <Badge tone="neutral">{event.category.name}</Badge>
            </div>
            <h1 className={event.schedule_status === "cancelled" ? "text-2xl font-extrabold text-ink-muted line-through sm:text-3xl" : "text-2xl font-extrabold sm:text-3xl"}>
              {event.title}
            </h1>
            <p className="flex items-center gap-1.5 font-semibold first-letter:uppercase">
              <Clock aria-hidden className="h-4 w-4 text-brand-700" />
              {WHEN.format(startsAt)}
              {endsAt ? ` – ${endsAt.toDateString() === startsAt.toDateString() ? HOUR.format(endsAt) : WHEN.format(endsAt)}` : ""}
            </p>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Ticket aria-hidden className="h-4 w-4 text-brand-700" />
              {price(event)}
            </p>
          </header>
          {!past && event.schedule_status !== "cancelled" && (
            <Suspense fallback={<Skeleton className="h-11 w-72" />}>
              <Engagement event={event} back={back} />
            </Suspense>
          )}
          <p className="whitespace-pre-line">{event.description}</p>
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <Location event={event} />
          </Suspense>
          <section aria-labelledby="source" className="flex flex-col gap-1 text-sm">
            <h2 id="source" className="text-lg font-bold">
              Source et vérification
            </h2>
            <p>Organisateur : {organizer}</p>
            <p className={event.source ? undefined : "italic text-ink-muted"}>Source : {event.source?.title ?? `annonce de l’organisateur, ${TO_CONFIRM.toLowerCase()}`}</p>
            <p>{event.verified_at ? `Dernière vérification : ${formatDate(event.verified_at)}` : "Pas encore vérifié par l’équipe locale"}</p>
            <p className="text-xs text-ink-subtle">
              Publié le {formatDate(event.published_at ?? event.updated_at)} · mis à jour le {formatDate(event.updated_at)}
            </p>
          </section>
        </div>
        <aside className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4" aria-label="Contacter l’organisateur">
          <h2 className="text-lg font-bold">Contacter l’organisateur</h2>
          {(event.contact_phone || event.contact_whatsapp || event.contact_email || event.ticket_url) && (
            <ul className="flex flex-col gap-1 text-sm">
              {event.contact_phone && (
                <li>
                  Téléphone : <a className="font-medium underline" href={contactLink("phone", event.contact_phone)}>{event.contact_phone}</a>
                </li>
              )}
              {event.contact_whatsapp && (
                <li>
                  WhatsApp : <a className="font-medium underline" href={contactLink("whatsapp", event.contact_whatsapp)}>{event.contact_whatsapp}</a>
                </li>
              )}
              {event.contact_email && (
                <li>
                  E-mail : <a className="font-medium underline" href={contactLink("email", event.contact_email)}>{event.contact_email}</a>
                </li>
              )}
              {event.ticket_url && (
                <li>
                  <a className="font-medium underline" href={event.ticket_url} target="_blank" rel="noopener noreferrer nofollow">
                    Billetterie (site externe)
                  </a>
                </li>
              )}
            </ul>
          )}
          {!past && <OrganizerMessageForm eventId={event.id} back={back} />}
          <ReportForm target={{ evenement: event.id }} back={back} label="Signaler cet événement" />
        </aside>
      </div>
    </div>
  );
}

export default function EventPage({ params }: Props) {
  return (
    <Container className="py-6 sm:py-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <EventView params={params} />
      </Suspense>
    </Container>
  );
}
