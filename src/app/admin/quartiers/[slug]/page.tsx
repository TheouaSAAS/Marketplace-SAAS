import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isCurator } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listSources } from "@/modules/guide/server/editorial";
import { BoundaryMap } from "@/modules/neighborhoods/components/boundary-map";
import { BoundaryClearForm, BoundaryProposalForm, BoundaryReviewForm, NeighborhoodForm } from "@/modules/neighborhoods/components/editorial-forms";
import { getNeighborhoodForEditing, listBoundaryHistory } from "@/modules/neighborhoods/server/editorial";
import { requireAccount } from "@/server/auth";
import { getCityContext } from "@/server/city-context";

export const metadata: Metadata = {
  title: "Modifier un quartier — administration",
  robots: { index: false, follow: false },
};

type Props = PageProps<"/admin/quartiers/[slug]">;

const BOUNDARY_STATUS = {
  draft: { label: "Brouillon", tone: "info" },
  validated: { label: "Publié", tone: "success" },
  rejected: { label: "Refusé", tone: "danger" },
  superseded: { label: "Remplacé", tone: "neutral" },
} as const;

async function Editor({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const account = await requireAccount(href("adminNeighborhood", { params: { slug } }));
  if (!isCurator(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe locale.
      </Alert>
    );
  }
  const { current } = await getCityContext();
  if (!current.id) return <Alert tone="warning" title="Quartiers indisponibles">La base de contenus n’est pas encore configurée.</Alert>;
  let loaded: [Awaited<ReturnType<typeof getNeighborhoodForEditing>>, Awaited<ReturnType<typeof listSources>>];
  try {
    loaded = await Promise.all([getNeighborhoodForEditing(current.id, slug), listSources()]);
  } catch (error) {
    logger.error("Quartier indisponible", { module: "quartiers", error });
    return <ErrorState title="Quartier momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const [hood, sources] = loaded;
  if (!hood) notFound();
  let history: Awaited<ReturnType<typeof listBoundaryHistory>> = [];
  try {
    history = await listBoundaryHistory(hood.id);
  } catch (error) {
    logger.warn("Historique des périmètres indisponible", { module: "quartiers", error });
  }
  const mapProps = { tileUrl: publicEnv.NEXT_PUBLIC_MAP_TILE_URL, attribution: publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold">{hood.name}</h1>
        <Link className="text-sm underline" href={href("neighborhoodDetail", { params: { slug: hood.slug } })}>
          Voir la fiche publique
        </Link>
      </div>
      <section aria-labelledby="fiche" className="flex flex-col gap-3">
        <h2 id="fiche" className="text-xl font-bold">
          Fiche
        </h2>
        <NeighborhoodForm key={hood.updated_at} hood={hood} sources={sources} isSteward={hood.steward_id === account.id} />
      </section>

      <section aria-labelledby="perimetre" className="flex flex-col gap-4">
        <h2 id="perimetre" className="text-xl font-bold">
          Périmètre
        </h2>
        <p className="text-sm text-ink-muted">
          Facultatif : un quartier peut exister sans carte. Un brouillon ne change rien au public tant qu’il n’est pas validé ; chaque version reste dans
          l’historique ci-dessous et au journal d’administration.
        </p>
        <details className="rounded-card border border-border bg-surface p-4">
          <summary className="cursor-pointer font-semibold">Proposer un périmètre</summary>
          <div className="mt-3">
            <BoundaryProposalForm hoodId={hood.id} slug={hood.slug} sources={sources} />
          </div>
        </details>
        {hood.boundary_validated_at && (
          <details className="rounded-card border border-border bg-surface p-4">
            <summary className="cursor-pointer font-semibold">Retirer le périmètre publié</summary>
            <div className="mt-3">
              <BoundaryClearForm hoodId={hood.id} slug={hood.slug} />
            </div>
          </details>
        )}
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun périmètre proposé pour l’instant.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {history.map((version) => (
              <li key={version.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={BOUNDARY_STATUS[version.status].tone}>{BOUNDARY_STATUS[version.status].label}</Badge>
                  <span>
                    Proposé le {formatDateTime(version.proposed_at)} · {version.area_km2.toLocaleString("fr-FR")} km²
                    {version.source_title ? ` · source : ${version.source_title}` : ""}
                  </span>
                </div>
                {version.note && <p>Note : {version.note}</p>}
                {version.reviewed_at && (
                  <p className="text-ink-muted">
                    Décision le {formatDateTime(version.reviewed_at)}
                    {version.review_note ? ` — ${version.review_note}` : ""}
                  </p>
                )}
                {version.status === "draft" && (
                  <>
                    <BoundaryMap geojson={version.geojson} {...mapProps} label={`Brouillon de périmètre du quartier ${hood.name}`} />
                    <BoundaryReviewForm boundaryId={version.id} slug={hood.slug} />
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default function AdminNeighborhoodPage({ params }: Props) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Quartiers", href: href("adminNeighborhoods") }, { label: "Fiche" }]} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
