import type { Metadata } from "next";
import { Suspense } from "react";
import { logger } from "@/lib/logger";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { PlansList } from "@/modules/businesses/components/plans-list";
import { loadWorkspace, WorkspaceHeader } from "@/modules/businesses/components/workspace-header";
import { listPlans } from "@/modules/businesses/server/pro-queries";
import { isFeatureEnabled } from "@/server/features";

export const metadata: Metadata = { title: "Espace professionnel — visibilité et offres" };

async function Offers({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await loadWorkspace(params, "proOffers");
  let plans;
  try {
    plans = await listPlans();
  } catch (error) {
    logger.error("Offres indisponibles", { module: "espace-pro", error });
    return <ErrorState title="Offres momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <>
      <WorkspaceHeader workspace={workspace} section="Visibilité et offres" />
      <p className="text-sm text-ink-muted">Votre page est gratuite et le restera : présentation, photos, annonces, demandes, avis et vérification ne dépendent d’aucun paiement.</p>
      <PlansList plans={plans} paymentsEnabled={isFeatureEnabled("payments")} />
    </>
  );
}

export default function WorkspaceOffersPage({ params }: PageProps<"/espace-pro/[id]/offres">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Offers params={params} />
    </Suspense>
  );
}
