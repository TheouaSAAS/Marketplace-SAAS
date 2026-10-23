import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Check, Circle } from "lucide-react";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { ButtonLink } from "@/components/ui/button";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { ORGANIZATION_KINDS, TEAM_ROLES, type OrganizationKind } from "@/modules/businesses/domain/pro";
import { publicationSteps, workspaceRights } from "@/modules/businesses/domain/workspace";
import { loadWorkspace, WorkspaceHeader } from "@/modules/businesses/components/workspace-header";
import { getWorkspaceStats } from "@/modules/businesses/server/workspace";

export const metadata: Metadata = { title: "Espace professionnel — aperçu" };

async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id, workspace } = await loadWorkspace(params, "proWorkspace");
  const { page, role } = workspace;
  let stats;
  try {
    stats = await getWorkspaceStats(id);
  } catch (error) {
    logger.error("Aperçu de l’espace pro indisponible", { module: "espace-pro", error });
    return <ErrorState title="Aperçu momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const steps = publicationSteps({
    status: page.status,
    complete: workspace.complete,
    missing: workspace.missing,
    verified: page.verification_status === "verified",
    verificationPending: workspace.verificationPending,
  });
  const rights = workspaceRights(role);
  return (
    <>
      <WorkspaceHeader workspace={workspace} section="Aperçu" />
      {page.status === "rejected" && page.rejection_reason && (
        <Alert tone="danger" title="Correction demandée">
          {page.rejection_reason}
        </Alert>
      )}
      <section aria-labelledby="etapes" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 id="etapes" className="text-lg font-bold">
          Ce qu’il faut faire
        </h2>
        <ol className="flex flex-col gap-2">
          {steps.map((step) => (
            <li key={step.label} className="flex items-start gap-2 text-sm">
              {step.done ? <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />}
              <span>
                <span className="font-semibold">
                  {step.label}
                  <span className="sr-only">{step.done ? " (fait)" : " (à faire)"}</span>
                </span>
                <span className="block text-ink-muted">{step.hint}</span>
              </span>
            </li>
          ))}
        </ol>
        {rights.canManageListings && (
          <ButtonLink href={href("proPageEditor", { params: { id } })} variant="secondary" className="self-start">
            Modifier la page
          </ButtonLink>
        )}
      </section>

      <section aria-labelledby="organisation" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-sm">
        <h2 id="organisation" className="text-lg font-bold">
          Organisation
        </h2>
        {page.organization ? (
          <p>
            Équipe « {page.organization.name} » · {ORGANIZATION_KINDS[page.organization.kind as OrganizationKind] ?? page.organization.kind}. Votre rôle :{" "}
            {TEAM_ROLES[role].label} — {TEAM_ROLES[role].rights}
          </p>
        ) : (
          <p className="text-ink-muted">Pas encore d’équipe : le titulaire peut la créer et inviter des collaborateurs depuis « Modifier la page et l’équipe ».</p>
        )}
      </section>

      {stats && (
        <section aria-labelledby="chiffres" className="flex flex-col gap-3">
          <h2 id="chiffres" className="text-lg font-bold">
            En bref
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Vues de la page", stats.page_views],
              ["Demandes à traiter", stats.requests_unanswered],
              ["Annonces en ligne", stats.listings_published],
              ["Avis publiés", stats.reviews_published],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col rounded-card border border-border bg-surface p-3">
                <span className="text-2xl font-extrabold">{value}</span>
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
          <Link href={href("proStats", { params: { id } })} className="text-sm underline">
            Toutes les statistiques et leurs définitions
          </Link>
        </section>
      )}
    </>
  );
}

export default function WorkspacePage({ params }: PageProps<"/espace-pro/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Overview params={params} />
    </Suspense>
  );
}
