import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Info, Search } from "lucide-react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { BusinessCard, ListingCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageNav } from "@/components/ui/page-nav";
import { SERVICES_RANKING_RULE, serviceQuery } from "@/modules/services/domain/params";
import { availabilityText, proContext } from "@/modules/services/domain/present";
import { ServiceFiltersForm } from "@/modules/services/components/service-filters";
import { TradeList } from "@/modules/services/components/trade-list";
import { loadServicesPage } from "@/modules/services/server/page-data";

export const metadata: Metadata = {
  title: "Services de proximité à San Pedro",
  description: "Trouver un artisan ou un prestataire : métier, quartier, distance, disponibilité déclarée, vérification, demande de devis.",
};

function NeedBox({ query }: { query: string }) {
  return (
    <Form action={href("services")} role="search" className="flex w-full max-w-3xl gap-2">
      <label htmlFor="besoin" className="sr-only">
        Décrivez votre besoin
      </label>
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
        <input
          id="besoin"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={120}
          placeholder="Ex. ma climatisation ne fonctionne plus"
          className="h-12 w-full rounded-pill border border-border-strong bg-surface pl-10 pr-4 text-base placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
      </div>
      <button type="submit" className="inline-flex h-12 shrink-0 items-center rounded-pill bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
        Trouver
      </button>
    </Form>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/services">, "searchParams">) {
  const data = await loadServicesPage(await searchParams);
  if (data.kind === "redirect") redirect(data.query ? `${href("services")}?${data.query}` : href("services"));
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Recherche indisponible">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="L’annuaire est momentanément indisponible" description="Réessayez dans quelques instants." />;
  const now = new Date();
  return (
    <div className="flex flex-col gap-6">
      <NeedBox query={data.filters.q} />
      {data.need?.trade && (
        <Alert tone="info" title={`Métier reconnu : ${data.need.trade.name}`}>
          D’après « {data.need.matched} » dans votre phrase (mots-clés du référentiel, sans intelligence artificielle).
          {data.need.urgent && " Urgence notée : contactez directement plusieurs professionnels ; aucune disponibilité n’est garantie."}
        </Alert>
      )}
      <TradeList tree={data.tree} current={data.filters.metier} />
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Affiner">
          <ServiceFiltersForm key={JSON.stringify(data.filters)} filters={data.filters} neighborhoods={data.neighborhoods} hasPosition={data.position !== null} />
        </aside>
        <section aria-labelledby="pros" className="flex min-w-0 flex-col gap-4">
          <h2 id="pros" className="text-xl font-bold">
            {data.total} professionnel{data.total > 1 ? "s" : ""}
            {data.trade ? ` · ${data.trade.name}` : ""}
          </h2>
          <details className="text-sm text-ink-muted">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
              <Info aria-hidden className="h-4 w-4" />
              Pourquoi cet ordre ?
            </summary>
            <p className="mt-1 max-w-2xl">{SERVICES_RANKING_RULE}</p>
          </details>
          {data.total === 0 ? (
            <EmptyState title="Aucun professionnel ne correspond" description="L’annuaire démarre : retirez un filtre ou choisissez un métier voisin." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((pro, index) => (
                <li key={pro.id} className="flex flex-col gap-1 [&>article]:flex-1">
                  <BusinessCard business={pro} now={now} index={index} context={proContext(pro)} href={href("professionalDetail", { params: { slug: pro.slug } })} />
                  {availabilityText(pro.availability_note, pro.availability_declared_at, now) && (
                    <p className="text-xs text-ink-muted">{availabilityText(pro.availability_note, pro.availability_declared_at, now)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <PageNav
            page={data.filters.page}
            total={data.total}
            pageSize={data.pageSize}
            hrefFor={(page) => `${href("services")}?${serviceQuery({ ...data.filters, page })}`}
          />
        </section>
      </div>
      {data.listings.length > 0 && (
        <section aria-labelledby="annonces-service" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="annonces-service" className="text-xl font-bold">
              Annonces de service{data.trade ? ` · ${data.trade.name}` : ""}
            </h2>
            <Link
              className="text-sm font-medium underline"
              href={href("search", { query: { type: "annonces", categorie: data.trade?.slug ?? "services-professionnels" } })}
            >
              Toutes les annonces de service
            </Link>
          </div>
          <p className="text-sm text-ink-muted">Les plus récentes, publiées par des particuliers ou des professionnels.</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.listings.map((listing, index) => (
              <li key={listing.id} className="flex [&>article]:flex-1">
                <ListingCard listing={listing} now={now} index={index} href={href("listingDetail", { params: { slug: listing.slug } })} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ServicesPage({ searchParams }: PageProps<"/services">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Services de proximité" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Services de proximité</h1>
        <p className="max-w-2xl text-ink-muted">
          Artisans et prestataires de San Pedro. Disponibilités déclarées par les professionnels et datées : rien n’est garanti en temps réel.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
