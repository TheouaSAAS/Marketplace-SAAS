import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { href } from "@/config/routes";
import { displayedVerification } from "@/domain/verification";
import { cn } from "@/lib/cn";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { VerificationBadge } from "@/components/ui/verification";
import { BusinessCard, EventCard, ListingCard, PlaceCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listBusinessesByIds } from "@/modules/businesses/server/queries";
import { listEventsByIds } from "@/modules/events/server/queries";
import { listListingsByIds } from "@/modules/listings/server/queries";
import { BoundaryMap } from "@/modules/neighborhoods/components/boundary-map";
import { boundaryNotice, NEIGHBORHOOD_NEUTRALITY, NEIGHBORHOOD_TABS, parseTab, type NeighborhoodTab } from "@/modules/neighborhoods/domain/tabs";
import {
  getNeighborhood,
  getNeighborhoodBoundary,
  getNeighborhoodCounts,
  listNeighborhoodContentIds,
  listNeighborhoodEventIds,
  type NeighborhoodDetail,
} from "@/modules/neighborhoods/server/queries";
import { listPlacesByIds } from "@/modules/places/server/queries";
import { TO_CONFIRM } from "@/modules/tourism/domain/attributes";
import { getCityContext } from "@/server/city-context";
import { isFeatureEnabled } from "@/server/features";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";

type Props = PageProps<"/quartiers/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { current } = await getCityContext();
  const hood = current.id ? await getNeighborhood(current.id, slug) : null;
  if (!hood) return { title: "Quartier", robots: { index: false, follow: true } };
  return { title: `${hood.name} — quartier de San Pedro`, description: hood.description?.slice(0, 160) ?? `Contenus enregistrés dans le quartier ${hood.name}.` };
}

/** Lien vers la page du domaine filtrée sur ce quartier. */
function domainLink(tab: NeighborhoodTab, slug: string): string | null {
  const query = { quartier: slug };
  switch (tab) {
    case "logement":
      return href("realEstateMode", { params: { mode: "location" }, query });
    case "services":
      return href("services", { query });
    case "commerces":
      return href("shops", { query });
    case "decouvrir":
    case "tourisme":
      return href("tourism", { query });
    default:
      return null;
  }
}

async function TabContent({ hood, tab }: { hood: NeighborhoodDetail; tab: NeighborhoodTab }) {
  const now = new Date();
  if (tab === "carte") {
    const geojson = await getNeighborhoodBoundary(hood.id);
    const onMap = (
      <Link href={href("map", { query: { quartier: hood.slug } })} className="inline-flex min-h-11 w-fit items-center gap-1 font-semibold text-brand-700 hover:underline">
        Voir les éléments rattachés sur la carte interactive
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    );
    if (!geojson) {
      return (
        <div className="flex flex-col gap-2">
          <Alert tone="warning" title="Pas de périmètre validé">
            Ce quartier n’a pas encore de limites tracées et validées par l’équipe locale : nous n’en dessinons pas d’approximatives.
          </Alert>
          {onMap}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {isFeatureEnabled("map") ? (
          <BoundaryMap
            geojson={geojson}
            tileUrl={publicEnv.NEXT_PUBLIC_MAP_TILE_URL}
            attribution={publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION}
            label={`Périmètre validé du quartier ${hood.name}`}
          />
        ) : (
          <p className="text-sm text-ink-muted">Carte désactivée pour le moment.</p>
        )}
        {hood.boundary_validated_at && <p className="text-xs text-ink-subtle">Périmètre validé le {formatDate(hood.boundary_validated_at)}.</p>}
        {onMap}
      </div>
    );
  }

  const categories = await listCategories();
  const ids = categoryIdsWithDescendants(categories, [...NEIGHBORHOOD_TABS[tab].categories]);
  const link = domainLink(tab, hood.slug);
  let cards: ReactNode[] = [];
  if (tab === "logement") {
    const listings = await listListingsByIds(await listNeighborhoodContentIds("listings", hood.id, ids));
    cards = listings.map((listing, index) => (
      <ListingCard key={listing.id} listing={listing} now={now} index={index} href={href("listingDetail", { params: { slug: listing.slug } })} />
    ));
  } else if (tab === "services") {
    const pros = await listBusinessesByIds(await listNeighborhoodContentIds("business_profiles", hood.id, ids));
    cards = pros.map((pro, index) => (
      <BusinessCard key={pro.id} business={pro} now={now} index={index} href={href("professionalDetail", { params: { slug: pro.slug } })} />
    ));
  } else {
    const places = await listPlacesByIds(await listNeighborhoodContentIds("places", hood.id, ids));
    cards = places.map((place, index) => (
      <PlaceCard key={place.id} place={place} now={now} index={index} href={href("placeDetail", { params: { slug: place.slug } })} />
    ));
  }
  const events = tab === "decouvrir" ? await listEventsByIds(await listNeighborhoodEventIds(hood.id)) : [];

  return (
    <div className="flex flex-col gap-4">
      {cards.length === 0 && events.length === 0 ? (
        <EmptyState title="Rien de rattaché pour l’instant" description={NEIGHBORHOOD_TABS[tab].empty} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => (
            <li key={index} className="flex [&>article]:flex-1">
              {card}
            </li>
          ))}
          {events.map((event, index) => (
            <li key={event.id} className="flex [&>article]:flex-1">
              <EventCard event={event} now={now} index={cards.length + index} context="Événement" href={href("eventDetail", { params: { slug: event.slug } })} />
            </li>
          ))}
        </ul>
      )}
      {link && cards.length > 0 && (
        <Link href={link} className="inline-flex min-h-11 w-fit items-center gap-1 font-semibold text-brand-700 hover:underline">
          Tout voir et filtrer dans ce quartier
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

async function Neighborhood({ params, searchParams }: Props) {
  const { slug } = await params;
  await connection();
  const { current } = await getCityContext();
  const hood = current.id ? await getNeighborhood(current.id, slug) : null;
  if (!hood) notFound();
  const tab = parseTab((await searchParams).onglet);
  const counts = await getNeighborhoodCounts(hood.id);
  const now = new Date();
  const notice = boundaryNotice(Boolean(hood.boundary_validated_at));
  const tabCount = (key: NeighborhoodTab) => (key === "decouvrir" ? (counts.decouvrir ?? 0) + (counts.evenements ?? 0) : (counts[key] ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Quartiers", href: href("neighborhoods") }, { label: hood.name }]} />
      <header className="flex flex-col gap-2">
        <VerificationBadge status={displayedVerification(hood.verification_status, hood.verified_at, now)} />
        <h1 className="text-3xl font-extrabold sm:text-4xl">{hood.name}</h1>
        {hood.alt_names.length > 0 && <p className="text-ink-muted">Aussi appelé : {hood.alt_names.join(", ")}</p>}
        <p className={cn("max-w-2xl", !hood.description && "italic text-ink-muted")}>{hood.description ?? `Description : ${TO_CONFIRM.toLowerCase()}.`}</p>
      </header>
      {hood.verification_status !== "verified" && (
        <Alert tone="warning" title="Fiche à confirmer localement">
          Le nom et le découpage de ce quartier n’ont pas encore été vérifiés par l’équipe locale.
        </Alert>
      )}
      {notice && <p className="max-w-2xl text-sm text-ink-muted">{notice}</p>}

      <nav aria-label="Rubriques du quartier" className="overflow-x-auto">
        <ul className="flex gap-1 border-b border-border">
          {(Object.keys(NEIGHBORHOOD_TABS) as NeighborhoodTab[]).map((key) => (
            <li key={key} className="shrink-0">
              <Link
                href={href("neighborhoodDetail", { params: { slug: hood.slug }, query: key === "decouvrir" ? {} : { onglet: key } })}
                aria-current={key === tab ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold",
                  key === tab ? "border-brand-600 text-brand-800" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {NEIGHBORHOOD_TABS[key].label}
                {key !== "carte" && <span className="text-xs font-normal">({tabCount(key)})</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Suspense key={tab} fallback={<Skeleton className="h-48 w-full" />}>
        <TabContent hood={hood} tab={tab} />
      </Suspense>

      <section aria-labelledby="source" className="flex flex-col gap-1 text-sm">
        <h2 id="source" className="text-lg font-bold">
          Source et vérification
        </h2>
        <p>Source : {hood.source?.title ?? TO_CONFIRM}</p>
        <p>{hood.verified_at ? `Dernier contrôle : ${formatDate(hood.verified_at)}` : "Pas encore contrôlée par l’équipe locale"}</p>
        <p className="text-xs text-ink-subtle">{NEIGHBORHOOD_NEUTRALITY}</p>
      </section>
    </div>
  );
}

export default function NeighborhoodPage(props: Props) {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Neighborhood {...props} />
      </Suspense>
    </Container>
  );
}
