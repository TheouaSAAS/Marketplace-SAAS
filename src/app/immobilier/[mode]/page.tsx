import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CompareBar } from "@/modules/real-estate/components/compare";
import { ModeNav } from "@/modules/real-estate/components/mode-nav";
import { PropertyFilters } from "@/modules/real-estate/components/property-filters";
import { PropertyResults } from "@/modules/real-estate/components/property-results";
import { PropertySearchBox } from "@/modules/real-estate/components/property-search-box";
import { realEstateQuery } from "@/modules/real-estate/domain/filters";
import { isRealEstateMode, REAL_ESTATE_MODE_KEYS, REAL_ESTATE_MODES, type RealEstateMode } from "@/modules/real-estate/domain/modes";
import { loadRealEstatePage } from "@/modules/real-estate/server/page-data";

type Props = PageProps<"/immobilier/[mode]">;

export function generateStaticParams() {
  return REAL_ESTATE_MODE_KEYS.map((mode) => ({ mode }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mode } = await params;
  if (!isRealEstateMode(mode)) return { title: "Immobilier" };
  return { title: `${REAL_ESTATE_MODES[mode].title} à San Pedro`, description: REAL_ESTATE_MODES[mode].description };
}

async function Results({ mode, searchParams }: { mode: RealEstateMode; searchParams: Props["searchParams"] }) {
  const data = await loadRealEstatePage(mode, await searchParams);
  const base = href("realEstateMode", { params: { mode } });
  if (data.kind === "redirect") redirect(data.query ? `${base}?${data.query}` : base);
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Recherche indisponible">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="La recherche immobilière est momentanément indisponible" description="Réessayez dans quelques instants." />;

  return (
    <div className="flex flex-col gap-6">
      <PropertySearchBox mode={mode} query={data.interpretation ? "" : data.filters.q} />
      {data.interpretation && (
        <Alert tone="info" title="Nous avons interprété votre recherche">
          {data.interpretation.understood.join(" · ")}
          {data.interpretation.keywords && ` · Mots-clés : « ${data.interpretation.keywords} »`}. Règles fixes, sans intelligence artificielle : modifiez les
          filtres si besoin.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Affiner la recherche">
          {/* Clé : le formulaire se recrée quand les critères changent (champs non contrôlés). */}
          <PropertyFilters key={realEstateQuery(data.filters)} mode={mode} filters={data.filters} neighborhoods={data.neighborhoods} />
        </aside>
        <section aria-labelledby="resultats" className="flex min-w-0 flex-col gap-4">
          <h2 id="resultats" className="text-xl font-bold">
            {data.total === 0 ? "Aucun bien" : `${data.total} bien${data.total > 1 ? "s" : ""}`} · {data.cityName}
          </h2>
          <p className="text-sm text-ink-muted">
            Les informations (prix, surface, disponibilité) sont déclarées par les annonceurs. Une annonce non confirmée depuis 30 jours est
            signalée « à reconfirmer ». Ne versez jamais d’argent avant d’avoir visité.
          </p>
          <PropertyResults mode={mode} filters={data.filters} total={data.total} items={data.items} pageSize={data.pageSize} now={new Date()} />
        </section>
      </div>
      <CompareBar />
    </div>
  );
}

export default async function RealEstateModePage({ params, searchParams }: Props) {
  const { mode } = await params;
  if (!isRealEstateMode(mode)) notFound();
  const info = REAL_ESTATE_MODES[mode];
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Immobilier", href: href("realEstate") }, { label: info.label }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{info.title}</h1>
        <p className="max-w-2xl text-ink-muted">{info.description}</p>
      </div>
      <ModeNav current={mode} />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Results mode={mode} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
