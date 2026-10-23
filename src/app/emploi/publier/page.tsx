import type { Metadata } from "next";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JOB_TYPES } from "@/modules/jobs/domain/attributes";
import { PublishJobForm } from "@/modules/jobs/components/job-forms";
import { getManageablePage } from "@/modules/businesses/server/workspace";
import { jobCategories } from "@/modules/jobs/server/page-data";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { requireAccount } from "@/server/auth";
import { getCityContext } from "@/server/city-context";

export const metadata: Metadata = {
  title: "Publier une offre",
  robots: { index: false, follow: false },
};

async function Publish({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await requireAccount(href("publishJob"));
  if (account.isSuspended) {
    return (
      <Alert tone="warning" title="Compte suspendu">
        Vous ne pouvez pas publier d’offre. Contactez l’équipe pour en connaître la raison.
      </Alert>
    );
  }
  const { current } = await getCityContext();
  const raw = await searchParams;
  const [{ types }, neighborhoods, page] = await Promise.all([
    jobCategories(),
    current.id ? listNeighborhoods(current.id) : Promise.resolve([]),
    getManageablePage(typeof raw.page === "string" ? raw.page : undefined),
  ]);
  return (
    <>
      {page && <Alert tone="info">Offre publiée au nom de la page « {page.name} » : visible de son équipe dans l’espace professionnel.</Alert>}
      <PublishJobForm
        pageId={page?.id}
        categories={types.map((type) => ({ id: type.id, name: JOB_TYPES[type.slug as keyof typeof JOB_TYPES] }))}
        neighborhoods={neighborhoods.map(({ id, name }) => ({ id, name }))}
      />
    </>
  );
}

export default function PublishJobPage({ searchParams }: PageProps<"/emploi/publier">) {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Emploi et opportunités", href: href("jobs") }, { label: "Publier une offre" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">Publier une offre</h1>
        <p className="text-ink-muted">
          Offre d’emploi, stage, mission, formation, appel à prestataires ou opportunité. Elle est relue par l’équipe de modération avant publication ; vous
          êtes notifié de la décision.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Publish searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
