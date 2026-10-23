import type { Metadata } from "next";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isStaff } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { displayAttributes } from "@/modules/listings/domain/attributes";
import { checkOffer } from "@/modules/jobs/domain/rules";
import { JobModerationForm } from "@/modules/jobs/components/job-forms";
import { jobCategories } from "@/modules/jobs/server/page-data";
import { listPendingJobs } from "@/modules/jobs/server/queries";
import { categoryIdsWithDescendants } from "@/server/repositories/categories";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Offres à modérer — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const DECISIONS: Record<string, string> = {
  publie: "Offre publiée : son auteur est notifié.",
  refuse: "Offre refusée : son auteur reçoit votre motif.",
};

/** Équipe de modération : l'interface le vérifie, la base le garantit. */
async function Queue({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("adminJobs"));
  if (!isStaff(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe de modération.
      </Alert>
    );
  }
  const decision = (await searchParams).decision;
  const notice = typeof decision === "string" ? DECISIONS[decision] : undefined;
  let offers: Awaited<ReturnType<typeof listPendingJobs>>;
  try {
    const { categories, types } = await jobCategories();
    offers = await listPendingJobs(categoryIdsWithDescendants(categories, types.map((type) => type.slug)));
  } catch (error) {
    logger.error("File de modération des offres indisponible", { module: "emploi", error });
    return <ErrorState title="File de modération momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {offers.length === 0 ? (
        <EmptyState title="Aucune offre en attente" description="Les nouvelles offres apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-4">
          {offers.map((offer) => {
            const hits = checkOffer(`${offer.title}\n${offer.description}`);
            return (
              <li key={offer.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                <h2 className="font-bold">{offer.title}</h2>
                <p className="text-xs text-ink-muted">
                  {offer.category.name} · proposée le {formatDateTime(offer.created_at)}
                </p>
                {hits.length > 0 && (
                  <Alert tone="danger" title="Formulations à vérifier">
                    {hits.map((hit) => `${hit.rule} (« ${hit.excerpt} »)`).join(" · ")}
                  </Alert>
                )}
                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
                  {displayAttributes("emploi", offer.attributes).map((item) => (
                    <div key={item.label} className="contents">
                      <dt className="text-ink-muted">{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="whitespace-pre-line text-sm">{offer.description}</p>
                <p className="text-xs text-ink-muted">
                  Vérifiez l’employeur, l’absence de frais demandés au candidat et de critère discriminatoire, la date limite et le lien de candidature.
                </p>
                <JobModerationForm offerId={offer.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminJobsPage({ searchParams }: PageProps<"/admin/offres">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Offres à modérer" }]} />
      <h1 className="text-3xl font-extrabold">Offres à modérer</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
