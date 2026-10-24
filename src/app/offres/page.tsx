import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PlansList } from "@/modules/businesses/components/plans-list";
import { listPlans } from "@/modules/businesses/server/pro-queries";
import { isFeatureEnabled } from "@/server/features";

export const metadata: Metadata = listMetadata({
  title: "Offres et visibilité",
  description: "Publication et page professionnelle gratuites. Options de visibilité présentées avec leur prix, toujours signalées « Sponsorisé ».",
  path: "/offres",
  searchParams: {},
});

async function Plans() {
  let plans;
  try {
    plans = await listPlans();
  } catch (error) {
    logger.error("Offres indisponibles", { module: "offres", error });
    return <ErrorState title="Offres momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return <PlansList plans={plans} paymentsEnabled={isFeatureEnabled("payments")} />;
}

export default function PricingPage() {
  return (
    <Container className="flex max-w-5xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Professionnels et entreprises", href: href("directory") }, { label: "Offres et visibilité" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Offres et visibilité</h1>
        <p className="max-w-2xl text-ink-muted">
          Publier une annonce et créer sa page professionnelle sont gratuits. Les options de visibilité, quand elles ouvriront, afficheront leur prix avant
          toute souscription et seront toujours signalées.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Plans />
      </Suspense>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={href("proPages")}>Créer ma page professionnelle</ButtonLink>
        <ButtonLink href={href("publish")} variant="secondary">
          Publier une annonce
        </ButtonLink>
      </div>
      <p className="text-sm text-ink-muted">
        Une question ?{" "}
        <Link href={href("contact")} className="underline">
          Contactez l’équipe
        </Link>
        .
      </p>
    </Container>
  );
}
