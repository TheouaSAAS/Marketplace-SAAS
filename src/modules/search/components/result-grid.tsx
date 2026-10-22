import { href } from "@/config/routes";
import { BusinessCard, EventCard, GuideCard, ListingCard, PlaceCard } from "@/components/content/content-cards";
import { formatDate } from "@/lib/format";
import { SEARCH_TYPES } from "../domain/params";
import { formatDistance } from "../domain/position";
import type { SearchItem } from "../server/queries";

/** Fraîcheur affichée pour chaque résultat : date de la dernière information connue. */
function freshness(item: SearchItem): string | null {
  const date = (value: string) => formatDate(value, "short");
  switch (item.type) {
    case "annonces": {
      const { published_at: published, last_confirmed_at: confirmed } = item.data;
      if (confirmed && (!published || confirmed > published)) return `confirmée le ${date(confirmed)}`;
      return published ? `publiée le ${date(published)}` : null;
    }
    case "lieux":
      return `mis à jour le ${date(item.data.updated_at)}`;
    case "professionnels":
      return `fiche mise à jour le ${date(item.data.updated_at)}`;
    case "evenements":
      return item.data.published_at ? `publié le ${date(item.data.published_at)}` : null;
    case "guide":
      return item.data.verified_at && item.data.verification_status === "verified"
        ? `vérifié le ${date(item.data.verified_at)}`
        : `mis à jour le ${date(item.data.updated_at)}`;
  }
}

/** Type, fraîcheur et distance (« environ » quand la position publiée est arrondie). */
export function resultContext(item: SearchItem): string {
  const approximate = item.type === "annonces" || item.type === "professionnels";
  return [SEARCH_TYPES[item.type].singular, freshness(item), item.distanceM !== null ? formatDistance(item.distanceM, approximate) : null]
    .filter(Boolean)
    .join(" · ");
}

function ResultCard({ item, now, index }: { item: SearchItem; now: Date; index: number }) {
  const context = resultContext(item);
  switch (item.type) {
    case "annonces":
      return <ListingCard listing={item.data} now={now} index={index} context={context} href={href("listingDetail", { params: { slug: item.data.slug } })} />;
    case "lieux":
      return <PlaceCard place={item.data} now={now} index={index} context={context} href={href("placeDetail", { params: { slug: item.data.slug } })} />;
    case "professionnels":
      return <BusinessCard business={item.data} now={now} index={index} context={context} href={href("professionalDetail", { params: { slug: item.data.slug } })} />;
    case "evenements":
      return <EventCard event={item.data} now={now} index={index} context={context} />;
    case "guide":
      return <GuideCard article={item.data} now={now} index={index} context={context} />;
  }
}

export function ResultGrid({ items, now, label }: { items: SearchItem[]; now: Date; label: string }) {
  return (
    <ul aria-label={label} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <li key={`${item.type}-${item.data.id}`} className="flex [&>article]:flex-1">
          <ResultCard item={item} now={now} index={index} />
        </li>
      ))}
    </ul>
  );
}
