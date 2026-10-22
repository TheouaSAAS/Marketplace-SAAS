import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isCurator } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CLAIMANT_ROLES } from "@/modules/shops/domain/claims";
import { ClaimReviewForm } from "@/modules/shops/components/claim-review-form";
import { listPendingClaims, type PlaceClaim } from "@/modules/shops/server/claims";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Revendications de vitrines — administration",
  robots: { index: false, follow: false },
};

/** Équipe locale (éditeurs locaux, administrateurs) : l'interface le vérifie, la base le garantit. */
async function ClaimsContent() {
  const account = await requireAccount(href("placeClaims"));
  if (!isCurator(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe locale.
      </Alert>
    );
  }
  let claims: PlaceClaim[];
  try {
    claims = await listPendingClaims();
  } catch (error) {
    logger.error("Lecture des revendications impossible", { module: "commerces", error });
    return <ErrorState title="Revendications momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  if (claims.length === 0) return <EmptyState title="Aucune revendication en attente" description="Les nouvelles demandes apparaîtront ici." />;
  return (
    <ul className="flex flex-col gap-4">
      {claims.map((claim) => (
        <li key={claim.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-bold">
              <Link className="underline" href={href("placeDetail", { params: { slug: claim.place.slug } })}>
                {claim.place.name}
              </Link>
            </h2>
            <p className="text-xs text-ink-muted">Demande du {formatDateTime(claim.created_at)}</p>
          </div>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-ink-muted">Demandeur</dt>
            <dd>
              {claim.claimant?.display_name ?? "Membre"} · {CLAIMANT_ROLES[claim.claimant_role]}
            </dd>
            <dt className="text-ink-muted">Élément vérifiable</dt>
            <dd>{claim.evidence}</dd>
            <dt className="text-ink-muted">Téléphone</dt>
            <dd>{claim.phone}</dd>
          </dl>
          <p className="whitespace-pre-line text-sm">{claim.message}</p>
          <p className="text-xs text-ink-muted">Vérifiez l’élément fourni (registre, appel, visite) avant de valider : le demandeur recevra les messages des clients.</p>
          <ClaimReviewForm claimId={claim.id} />
        </li>
      ))}
    </ul>
  );
}

export default function PlaceClaimsPage() {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Revendications de vitrines" }]} />
      <h1 className="text-3xl font-extrabold">Revendications de vitrines</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ClaimsContent />
      </Suspense>
    </Container>
  );
}
