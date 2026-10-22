import Link from "next/link";
import { redirect } from "next/navigation";
import { Info, Route } from "lucide-react";
import { href } from "@/config/routes";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageNav } from "@/components/ui/page-nav";
import { EventCard, PlaceCard } from "@/components/content/content-cards";
import { formatDistance } from "@/modules/search/domain/position";
import { TOURISM_ADVICE, type TourismEntry } from "../domain/entries";
import { TOURISM_RANKING_RULE, tourismQuery } from "../domain/params";
import { loadTourismPage } from "../server/page-data";
import { TourismFiltersForm } from "./tourism-filters";

/** Conseils de prudence (aucune donnée locale) et pistes quand l'annuaire est encore vide : la page reste utile. */
export function TourismAdvice() {
  return (
    <section aria-labelledby="prudence" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h2 id="prudence" className="text-lg font-bold">
        Avant de partir
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        {TOURISM_ADVICE.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      <p className="text-sm">
        Pour vous repérer et vous déplacer : <Link className="font-medium underline" href={href("guide")}>guide pratique</Link> ·{" "}
        <Link className="font-medium underline" href={href("neighborhoods")}>quartiers</Link>.
      </p>
    </section>
  );
}

/** Exploration filtrable (toutes catégories touristiques ou une entrée), adresse canonique. */
export async function TourismExplorer({
  searchParams,
  entry,
  action,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  entry: TourismEntry | null;
  action: string;
}) {
  const data = await loadTourismPage(await searchParams, entry);
  if (data.kind === "redirect") redirect(data.query ? `${action}?${data.query}` : action);
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Contenus indisponibles">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="Les lieux sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  const now = new Date();
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={href("itinerary")}
        className="flex items-center gap-3 rounded-card border border-brand-200 bg-brand-50 p-4 font-semibold text-brand-800 hover:border-brand-400"
      >
        <Route aria-hidden className="h-5 w-5 shrink-0" />
        Composer un itinéraire avec les lieux réellement enregistrés
      </Link>
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Affiner">
          <TourismFiltersForm key={tourismQuery(data.filters)} action={action} filters={data.filters} types={data.types} hasPosition={data.position !== null} />
        </aside>
        <section aria-labelledby="lieux" className="flex min-w-0 flex-col gap-4">
          <h2 id="lieux" className="text-xl font-bold">
            {data.total} lieu{data.total > 1 ? "x" : ""}
            {data.type ? ` · ${data.type.name}` : ""}
          </h2>
          <details className="text-sm text-ink-muted">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
              <Info aria-hidden className="h-4 w-4" />
              Pourquoi cet ordre ?
            </summary>
            <p className="mt-1 max-w-2xl">{TOURISM_RANKING_RULE}</p>
          </details>
          {data.total === 0 ? (
            <EmptyState
              title="Aucun lieu enregistré ne correspond"
              description="Les fiches sont ajoutées et vérifiées par l’équipe locale au fil de l’eau : retirez un filtre, ou signalez-nous un lieu à ajouter depuis la page Contact."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((place, index) => (
                <li key={place.id} className="flex [&>article]:flex-1">
                  <PlaceCard
                    place={place}
                    now={now}
                    index={index}
                    href={href("placeDetail", { params: { slug: place.slug } })}
                    context={place.distanceM != null ? formatDistance(place.distanceM, true) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
          <PageNav page={data.filters.page} total={data.total} pageSize={data.pageSize} hrefFor={(page) => `${action}?${tourismQuery({ ...data.filters, page })}`} />
        </section>
      </div>
      {entry === "sortir" && (
        <section aria-labelledby="evenements" className="flex flex-col gap-3">
          <h2 id="evenements" className="text-xl font-bold">
            Événements à venir
          </h2>
          {data.events.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucun événement à venir enregistré pour l’instant.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.events.map((event, index) => (
                <li key={event.id} className="flex [&>article]:flex-1">
                  <EventCard event={event} now={now} index={index} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <TourismAdvice />
    </div>
  );
}
