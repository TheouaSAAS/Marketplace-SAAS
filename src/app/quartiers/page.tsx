import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { href } from "@/config/routes";
import { displayedVerification } from "@/domain/verification";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { VerificationBadge } from "@/components/ui/verification";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NEIGHBORHOOD_NEUTRALITY } from "@/modules/neighborhoods/domain/tabs";
import { getNeighborhoodOverview, type NeighborhoodOverview } from "@/modules/neighborhoods/server/queries";
import { getCityContext } from "@/server/city-context";

export const metadata: Metadata = {
  title: "Quartiers de San Pedro",
  description: "Les quartiers de San Pedro et les contenus réellement enregistrés qui y sont rattachés : logements, services, commerces, lieux, événements.",
};

async function NeighborhoodList() {
  await connection();
  const { current } = await getCityContext();
  if (!current.id) return <Alert tone="warning" title="Quartiers indisponibles">La base de contenus n’est pas encore configurée.</Alert>;
  const now = new Date();
  let rows: NeighborhoodOverview[];
  try {
    rows = await getNeighborhoodOverview(current.id);
  } catch (error) {
    logger.error("Quartiers indisponibles", { module: "quartiers", error });
    return <ErrorState title="Les quartiers sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  if (rows.length === 0) return <EmptyState title="Aucun quartier enregistré" description="La liste des quartiers est en cours de constitution avec l’équipe locale." />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <li key={row.slug}>
          <Link
            href={href("neighborhoodDetail", { params: { slug: row.slug } })}
            className="flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-4 hover:border-brand-300"
          >
            <span className="flex items-center gap-1.5 text-lg font-bold">
              <MapPin aria-hidden className="h-4 w-4 text-brand-700" />
              {row.name}
            </span>
            {row.alt_names.length > 0 && <span className="text-xs text-ink-muted">Aussi appelé : {row.alt_names.join(", ")}</span>}
            <span className="flex flex-wrap gap-1.5">
              <VerificationBadge status={displayedVerification(row.verification_status, row.verified_at, now)} />
              <Badge tone="neutral">{row.bounded ? "Périmètre validé" : "Sans périmètre validé"}</Badge>
            </span>
            <span className="text-sm text-ink-muted">
              {row.total > 0 ? `${row.total} contenu${row.total > 1 ? "s" : ""} rattaché${row.total > 1 ? "s" : ""}` : "Aucun contenu rattaché pour l’instant"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function NeighborhoodsPage() {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Quartiers" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Quartiers de San Pedro</h1>
        <p className="max-w-2xl text-ink-muted">Par ordre alphabétique. Noms et découpage à confirmer localement tant qu’ils ne sont pas vérifiés.</p>
        <p className="max-w-2xl text-xs text-ink-subtle">{NEIGHBORHOOD_NEUTRALITY}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-card" />}>
        <NeighborhoodList />
      </Suspense>
    </Container>
  );
}
