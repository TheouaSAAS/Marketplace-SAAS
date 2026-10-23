import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isCurator } from "@/domain/roles";
import { VERIFICATION_META } from "@/domain/verification";
import { formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listNeighborhoodsForEditing, type EditableNeighborhood } from "@/modules/neighborhoods/server/editorial";
import { requireAccount } from "@/server/auth";
import { getCityContext } from "@/server/city-context";

export const metadata: Metadata = {
  title: "Quartiers — administration",
  robots: { index: false, follow: false },
};

/** Équipe locale (éditeurs locaux, administrateurs) : l'interface le vérifie, la base le garantit. */
async function NeighborhoodsAdmin() {
  const account = await requireAccount(href("adminNeighborhoods"));
  if (!isCurator(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe locale.
      </Alert>
    );
  }
  const { current } = await getCityContext();
  if (!current.id) return <Alert tone="warning" title="Quartiers indisponibles">La base de contenus n’est pas encore configurée.</Alert>;
  let rows: EditableNeighborhood[];
  try {
    rows = await listNeighborhoodsForEditing(current.id);
  } catch (error) {
    logger.error("Administration des quartiers indisponible", { module: "quartiers", error });
    return <ErrorState title="Quartiers momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
          <Link className="font-bold underline" href={href("adminNeighborhood", { params: { slug: row.slug } })}>
            {row.name}
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Badge tone={row.verification_status === "verified" ? "success" : "warning"}>{VERIFICATION_META[row.verification_status].label}</Badge>
            <Badge tone="neutral">{row.boundary_validated_at ? `Périmètre validé le ${formatDate(row.boundary_validated_at)}` : "Sans périmètre"}</Badge>
            {!row.is_active && <Badge tone="warning">Inactif</Badge>}
            <span>{row.steward_id ? (row.steward_id === account.id ? "Responsable : vous" : "Responsable désigné") : "Sans responsable"}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminNeighborhoodsPage() {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Administration", href: href("admin") }, { label: "Quartiers" }]} />
      <h1 className="text-3xl font-extrabold">Quartiers : fiches et périmètres</h1>
      <p className="max-w-2xl text-sm text-ink-muted">
        Chaque modification est historisée avec sa note ; un périmètre n’est publié qu’après validation d’un brouillon, et l’ancien reste consultable.
      </p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <NeighborhoodsAdmin />
      </Suspense>
    </Container>
  );
}
