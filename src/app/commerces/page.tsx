import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import Form from "next/form";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Info, Search } from "lucide-react";
import { href } from "@/config/routes";
import { SponsoredBadge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { PageNav } from "@/components/ui/page-nav";
import { Skeleton } from "@/components/ui/spinner";
import { PlaceCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatDistance } from "@/modules/search/domain/position";
import { SHOPS_RANKING_RULE, shopQuery, type ShopFilters } from "@/modules/shops/domain/params";
import { ShopFiltersForm } from "@/modules/shops/components/shop-filters";
import { ShopViews } from "@/modules/shops/components/shop-views";
import { loadShopsPage } from "@/modules/shops/server/page-data";

/** Variantes filtrées ou triées : canonique vers la rubrique, non indexées. */
export async function generateMetadata({ searchParams }: PageProps<"/commerces">): Promise<Metadata> {
  return listMetadata({
    title: "Commerces de proximité à San Pedro",
    description: "Restaurants, alimentation, boutiques, quincailleries, auto, téléphonie : vitrines locales avec horaires sourcés ou signalés « à confirmer ».",
    path: "/commerces",
    searchParams: await searchParams,
    keep: ["type"],
  });
}

function ShopSearch({ filters }: { filters: ShopFilters }) {
  return (
    <Form action={href("shops")} role="search" className="flex w-full max-w-3xl gap-2">
      {filters.type && <input type="hidden" name="type" value={filters.type} />}
      <label htmlFor="commerce" className="sr-only">
        Rechercher un commerce ou un produit
      </label>
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
        <input
          id="commerce"
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={120}
          placeholder="Ex. ciment, poisson braisé, chargeur"
          className="h-12 w-full rounded-pill border border-border-strong bg-surface pl-10 pr-4 text-base placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
      </div>
      <button type="submit" className="inline-flex h-12 shrink-0 items-center rounded-pill bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
        Rechercher
      </button>
    </Form>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/commerces">, "searchParams">) {
  const data = await loadShopsPage(await searchParams);
  if (data.kind === "redirect") redirect(data.query ? `${href("shops")}?${data.query}` : href("shops"));
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Annuaire indisponible">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="L’annuaire est momentanément indisponible" description="Réessayez dans quelques instants." />;
  const now = new Date();
  const detail = (slug: string) => href("placeDetail", { params: { slug } });
  return (
    <div className="flex flex-col gap-6">
      <ShopSearch filters={data.filters} />
      <ShopViews views={data.views} current={data.filters.type} />
      {data.sponsored.length > 0 && (
        <section aria-labelledby="sponsorises" className="flex flex-col gap-3 rounded-card border border-accent-200 bg-accent-50 p-4">
          <div className="flex flex-col gap-1">
            <h2 id="sponsorises" className="text-lg font-bold">
              Mis en avant
            </h2>
            <p className="text-sm text-ink-muted">
              Emplacements payés par ces commerces, à part des résultats : ils ne modifient ni l’ordre ni la vérification des fiches.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.sponsored.map((place, index) => (
              <li key={place.id} className="flex [&>article]:flex-1">
                <PlaceCard place={place} now={now} index={index} href={detail(place.slug)} badge={<SponsoredBadge />} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Affiner">
          <ShopFiltersForm
            key={shopQuery(data.filters)}
            filters={data.filters}
            neighborhoods={data.neighborhoods}
            hasPosition={data.position !== null}
            showAmbiance={!data.view || data.view.slug === "restaurants-gastronomie"}
          />
        </aside>
        <section aria-labelledby="resultats" className="flex min-w-0 flex-col gap-4">
          <h2 id="resultats" className="text-xl font-bold">
            {data.total} commerce{data.total > 1 ? "s" : ""}
            {data.view ? ` · ${data.view.name}` : ""}
          </h2>
          <details className="text-sm text-ink-muted">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
              <Info aria-hidden className="h-4 w-4" />
              Pourquoi cet ordre ?
            </summary>
            <p className="mt-1 max-w-2xl">{SHOPS_RANKING_RULE}</p>
          </details>
          {data.total === 0 ? (
            <EmptyState title="Aucun commerce ne correspond" description="L’annuaire démarre : retirez un filtre ou choisissez un autre type de commerce." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((place, index) => (
                <li key={place.id} className="flex [&>article]:flex-1">
                  <PlaceCard
                    place={place}
                    now={now}
                    index={index}
                    href={detail(place.slug)}
                    context={place.distanceM != null ? formatDistance(place.distanceM, true) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
          <PageNav
            page={data.filters.page}
            total={data.total}
            pageSize={data.pageSize}
            hrefFor={(page) => `${href("shops")}?${shopQuery({ ...data.filters, page })}`}
          />
        </section>
      </div>
    </div>
  );
}

export default function ShopsPage({ searchParams }: PageProps<"/commerces">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Commerces de proximité" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Commerces de proximité</h1>
        <p className="max-w-2xl text-ink-muted">
          Restaurants, alimentation, boutiques et ateliers de San Pedro. Horaires affichés comme vérifiés seulement avec leur source et leur date ;
          sinon « à confirmer ».
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
