import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BedDouble, Compass, PartyPopper, Route, Utensils, type LucideIcon } from "lucide-react";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { EventCard, PlaceCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listUpcomingEvents } from "@/modules/events/server/queries";
import { listPlacesByCategories } from "@/modules/places/server/queries";
import { TOURISM_CATEGORIES, TOURISM_ENTRIES, type TourismEntry } from "@/modules/tourism/domain/entries";
import { TourismAdvice } from "@/modules/tourism/components/tourism-explorer";
import { getCityContext } from "@/server/city-context";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";

export const metadata: Metadata = listMetadata({
  title: "Découvrir et sortir à San Pedro",
  description: "Où dormir, où manger, que découvrir, où sortir : lieux datés et sourcés, itinéraires composés uniquement avec des lieux réellement enregistrés.",
  path: "/decouvrir",
  searchParams: {},
});

const ICONS: Record<TourismEntry, LucideIcon> = { "ou-dormir": BedDouble, "ou-manger": Utensils, "que-decouvrir": Compass, sortir: PartyPopper };

async function Highlights() {
  await connection();
  const { current } = await getCityContext();
  if (!current.id) return null;
  const now = new Date();
  const [places, events] = await Promise.all([
    listCategories()
      .then((categories) => listPlacesByCategories(current.id!, categoryIdsWithDescendants(categories, TOURISM_CATEGORIES), 6))
      .catch((error: unknown) => {
        logger.warn("Lieux à la une indisponibles", { module: "tourisme", error });
        return [];
      }),
    listUpcomingEvents(current.id, 3).catch(() => []),
  ]);
  return (
    <>
      <section aria-labelledby="a-la-une" className="flex flex-col gap-3">
        <h2 id="a-la-une" className="text-xl font-bold">
          Lieux enregistrés
        </h2>
        <p className="text-sm text-ink-muted">Les fiches vérifiées récemment d’abord, puis les plus récemment mises à jour.</p>
        {places.length === 0 ? (
          <EmptyState title="Aucun lieu enregistré pour l’instant" description="L’équipe locale ajoute et vérifie les fiches au fil de l’eau." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {places.map((place, index) => (
              <li key={place.id} className="flex [&>article]:flex-1">
                <PlaceCard place={place} now={now} index={index} href={href("placeDetail", { params: { slug: place.slug } })} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {events.length > 0 && (
        <section aria-labelledby="evenements" className="flex flex-col gap-3">
          <h2 id="evenements" className="text-xl font-bold">
            Événements à venir
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, index) => (
              <li key={event.id} className="flex [&>article]:flex-1">
                <EventCard event={event} now={now} index={index} href={href("eventDetail", { params: { slug: event.slug } })} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function DiscoverPage() {
  return (
    <Container className="flex flex-col gap-8 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Découvrir et sortir" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Découvrir et sortir</h1>
        <p className="max-w-2xl text-ink-muted">
          San Pedro et ses environs, à partir des seuls lieux enregistrés par l’équipe locale : chaque fiche indique sa source, son statut et sa date de
          vérification.
        </p>
      </div>
      <nav aria-label="Que cherchez-vous ?">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(TOURISM_ENTRIES) as [TourismEntry, (typeof TOURISM_ENTRIES)[TourismEntry]][]).map(([entree, entry]) => {
            const Icon = ICONS[entree];
            return (
              <li key={entree}>
                <Link
                  href={href("discoverEntry", { params: { entree } })}
                  className="flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-4 hover:border-brand-300"
                >
                  <Icon aria-hidden className="h-6 w-6 text-brand-700" />
                  <span className="text-lg font-bold">{entry.title}</span>
                  <span className="text-sm text-ink-muted">{entry.intro}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Link href={href("itinerary")} className="flex items-center gap-3 rounded-card border border-brand-200 bg-brand-50 p-4 hover:border-brand-400">
        <Route aria-hidden className="h-6 w-6 shrink-0 text-brand-700" />
        <span className="flex flex-col">
          <span className="font-bold text-brand-800">Composer un itinéraire</span>
          <span className="text-sm text-ink-muted">Une demi-journée, une journée ou deux jours, uniquement avec des lieux réellement enregistrés.</span>
        </span>
      </Link>
      <Link href={href("tourism")} className="w-fit text-sm font-semibold underline">
        Explorer tous les lieux avec les filtres
      </Link>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <Highlights />
      </Suspense>
      <TourismAdvice />
    </Container>
  );
}
