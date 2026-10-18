import { CalendarDays, MapPin, Package, Store } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { eventBadge } from "@/domain/event-timing";
import { displayedVerification, type VerificationStatus } from "@/domain/verification";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { EventCardData } from "@/modules/events/server/queries";
import type { ListingCardData } from "@/modules/listings/server/queries";
import type { PlaceCardData } from "@/modules/places/server/queries";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/verification";
import { CategoryVisual } from "./category-visual";

/*
 * Cartes de contenu de l'accueil et des listes. Chaque carte affiche le statut
 * de vérification tel qu'il doit apparaître au public (une vérification
 * expirée redevient « À vérifier »). Les cartes ne sont pas encore cliquables :
 * les pages de détail arrivent aux niveaux 8, 12 et 16 — pas de lien vers une
 * page inexistante.
 */

function CardShell({ index = 0, visual, children }: { index?: number; visual: ReactNode; children: ReactNode }) {
  return (
    <article
      className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card animate-slide-up [animation-fill-mode:both]"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` } as CSSProperties}
    >
      {visual}
      <div className="flex flex-1 flex-col gap-2 p-4">{children}</div>
    </article>
  );
}

function Meta({ items }: { items: (string | null | undefined)[] }) {
  const parts = items.filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="flex items-center gap-1 text-sm text-ink-muted">
      <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{parts.join(" · ")}</span>
    </p>
  );
}

function PublicVerification({ status, verifiedAt, now }: { status: VerificationStatus; verifiedAt: string | null; now: Date }) {
  return <VerificationBadge status={displayedVerification(status, verifiedAt, now)} />;
}

const AVAILABILITY: Record<ListingCardData["availability_status"], { label: string; tone: "success" | "warning" | "neutral" } | null> = {
  available: { label: "Disponible (déclaré)", tone: "success" },
  reserved: { label: "Réservé", tone: "warning" },
  unavailable: { label: "Indisponible", tone: "neutral" },
  unknown: null,
};

export function ListingCard({ listing, now, index }: { listing: ListingCardData; now: Date; index?: number }) {
  const availability = AVAILABILITY[listing.availability_status];
  return (
    <CardShell index={index} visual={<CategoryVisual icon={listing.category?.icon} fallback={Package} tone="brand" />}>
      <div className="flex flex-wrap gap-1.5">
        <PublicVerification status={listing.verification_status} verifiedAt={listing.verified_at} now={now} />
        {availability && <Badge tone={availability.tone}>{availability.label}</Badge>}
      </div>
      <h3 className="line-clamp-2 font-bold leading-snug">{listing.title}</h3>
      <Meta items={[listing.category?.name, listing.neighborhood?.name]} />
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <p className="font-bold text-brand-800">{formatPrice(listing.price, listing.price_unit ?? "total")}</p>
        {listing.published_at && <p className="text-xs text-ink-subtle">Publiée le {formatDate(listing.published_at, "short")}</p>}
      </div>
    </CardShell>
  );
}

export function PlaceCard({ place, now, index }: { place: PlaceCardData; now: Date; index?: number }) {
  return (
    <CardShell
      index={index}
      visual={<CategoryVisual icon={place.category?.icon} fallback={Store} tone={place.kind === "lieu_touristique" ? "lagoon" : "sand"} />}
    >
      <div className="flex flex-wrap gap-1.5">
        <PublicVerification status={place.verification_status} verifiedAt={place.verified_at} now={now} />
      </div>
      <h3 className="line-clamp-2 font-bold leading-snug">{place.name}</h3>
      {place.summary && <p className="line-clamp-2 text-sm text-ink-muted">{place.summary}</p>}
      <Meta items={[place.category?.name, place.neighborhood?.name]} />
    </CardShell>
  );
}

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "Africa/Abidjan" });
const MONTH_FORMAT = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "Africa/Abidjan" });

export function EventCard({ event, now, index }: { event: EventCardData; now: Date; index?: number }) {
  const startsAt = new Date(event.starts_at);
  const badge = eventBadge(startsAt, event.ends_at ? new Date(event.ends_at) : null, event.schedule_status, now);
  const cancelled = event.schedule_status === "cancelled";
  return (
    <CardShell
      index={index}
      visual={
        <div aria-hidden="true" className="flex aspect-[16/9] items-center justify-center gap-4 bg-gradient-to-br from-accent-50 to-accent-100 text-accent-700">
          <CalendarDays className="h-8 w-8 opacity-70" strokeWidth={1.5} />
          <span className="flex flex-col items-center leading-none">
            <span className="text-3xl font-extrabold">{DAY_FORMAT.format(startsAt)}</span>
            <span className="text-sm font-semibold uppercase">{MONTH_FORMAT.format(startsAt)}</span>
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <PublicVerification status={event.verification_status} verifiedAt={event.verified_at} now={now} />
      </div>
      <h3 className={cn("line-clamp-2 font-bold leading-snug", cancelled && "text-ink-muted line-through")}>{event.title}</h3>
      <p className="text-sm font-medium first-letter:uppercase">{formatDateTime(event.starts_at)}</p>
      <Meta items={[event.category?.name, event.neighborhood?.name]} />
      <p className="mt-auto pt-2 text-sm font-semibold text-brand-800">
        {event.is_free ? "Gratuit" : event.price_min !== null ? formatPrice(event.price_min, "a_partir_de") : "Tarif non communiqué"}
      </p>
    </CardShell>
  );
}
