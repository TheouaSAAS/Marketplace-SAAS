import { CalendarClock } from "lucide-react";
import { displayedVerification } from "@/domain/verification";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/verification";
import { AVAILABILITY_BADGES, AVAILABILITY_NOTE } from "../domain/availability";
import type { ListingDetail } from "../server/detail";


export function ListingHeader({ listing, now, active }: { listing: ListingDetail; now: Date; active: boolean }) {
  const availability = AVAILABILITY_BADGES[listing.availability_status];
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <VerificationBadge status={displayedVerification(listing.verification_status, listing.verified_at, now)} />
        {availability && (
          <Badge tone={availability.tone} title={AVAILABILITY_NOTE}>
            {availability.label}
          </Badge>
        )}
      </div>
      <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{listing.title}</h1>
      <p className="text-2xl font-bold text-brand-800">
        {formatPrice(listing.price, listing.price_unit ?? "total")}
        {listing.is_negotiable && <span className="ml-2 text-base font-medium text-ink-muted">(à débattre)</span>}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        {listing.published_at && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock aria-hidden className="h-4 w-4" />
            Publiée le {formatDate(listing.published_at)}
          </span>
        )}
        {listing.last_confirmed_at && <span>Confirmée le {formatDate(listing.last_confirmed_at)}</span>}
        {listing.expires_at && active && <span>Visible jusqu’au {formatDate(listing.expires_at)}</span>}
      </p>
    </header>
  );
}
