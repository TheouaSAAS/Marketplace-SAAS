import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { formatDate, formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ApplicationStatusForm, CloseJobButton } from "@/modules/jobs/components/job-forms";
import { jobCategories } from "@/modules/jobs/server/page-data";
import { listMyOffers, listReceivedApplications, type MyOffer, type ReceivedApplication } from "@/modules/jobs/server/queries";
import { categoryIdsWithDescendants } from "@/server/repositories/categories";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes offres et candidatures reçues",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const APPLICATION_LABELS: Record<string, { label: string; tone: "info" | "neutral" | "success" | "warning" | "danger" }> = {
  submitted: { label: "Nouvelle", tone: "info" },
  viewed: { label: "Vue", tone: "neutral" },
  shortlisted: { label: "Retenue", tone: "success" },
  rejected: { label: "Non retenue", tone: "neutral" },
  withdrawn: { label: "Retirée par le candidat", tone: "warning" },
};

async function Employer({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("receivedApplications"));
  const published = (await searchParams).publie === "1";
  let offers: MyOffer[];
  let applications: ReceivedApplication[];
  try {
    const { categories, types } = await jobCategories();
    [offers, applications] = await Promise.all([
      listMyOffers(account.id, categoryIdsWithDescendants(categories, types.map((type) => type.slug))),
      listReceivedApplications(),
    ]);
  } catch (error) {
    logger.error("Espace employeur indisponible", { module: "emploi", error });
    return <ErrorState title="Vos offres sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  const now = new Date();
  return (
    <div className="flex flex-col gap-8">
      {published && (
        <Alert tone="success" title="Offre envoyée en modération">
          L’équipe la relit avant publication ; vous serez notifié de la décision.
        </Alert>
      )}
      <section aria-labelledby="mes-offres" className="flex flex-col gap-3">
        <h2 id="mes-offres" className="text-xl font-bold">
          Mes offres ({offers.length})
        </h2>
        {offers.length === 0 ? (
          <EmptyState title="Aucune offre publiée" description="Publiez une offre : elle est relue avant publication." action={<ButtonLink href={href("publishJob")}>Publier une offre</ButtonLink>} />
        ) : (
          <ul className="flex flex-col gap-2">
            {offers.map((offer) => {
              const closed = offer.availability_status === "unavailable" || offer.status === "expired" || (offer.expires_at !== null && new Date(offer.expires_at) <= now);
              return (
                <li key={offer.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CONTENT_STATUS_META[offer.status].tone}>{CONTENT_STATUS_META[offer.status].label}</Badge>
                    {offer.status === "published" && <Badge tone={closed ? "neutral" : "success"}>{closed ? "Close" : "Ouverte"}</Badge>}
                    <span className="text-xs text-ink-muted">{offer.category.name}</span>
                  </div>
                  {offer.status === "published" ? (
                    <Link href={href("listingDetail", { params: { slug: offer.slug } })} className="font-bold underline">
                      {offer.title}
                    </Link>
                  ) : (
                    <p className="font-bold">{offer.title}</p>
                  )}
                  {offer.expires_at && <p className="text-xs text-ink-muted">Expire le {formatDate(offer.expires_at)}</p>}
                  {offer.status === "rejected" && offer.rejection_reason && <p className="text-sm text-danger">Motif du refus : {offer.rejection_reason}</p>}
                  {offer.status === "published" && !closed && <CloseJobButton offerId={offer.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="recues" className="flex flex-col gap-3">
        <h2 id="recues" className="text-xl font-bold">
          Candidatures reçues ({applications.length})
        </h2>
        <p className="text-sm text-ink-muted">
          Privées : seuls vous et le candidat les voyez. Chaque décision est la vôtre (aucun tri automatique) et le candidat en est notifié. Pour lui
          répondre, utilisez la messagerie depuis l’offre.
        </p>
        {applications.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucune candidature pour l’instant.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {applications.map((application) => (
              <li key={application.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={APPLICATION_LABELS[application.status]!.tone}>{APPLICATION_LABELS[application.status]!.label}</Badge>
                  <span className="text-xs text-ink-muted">{formatDateTime(application.created_at)}</span>
                </div>
                <p className="font-bold">
                  {application.applicant_name} →{" "}
                  <Link href={href("listingDetail", { params: { slug: application.listing_slug } })} className="underline">
                    {application.listing_title}
                  </Link>
                </p>
                <p className="whitespace-pre-line text-sm">{application.message}</p>
                {application.status !== "withdrawn" && <ApplicationStatusForm applicationId={application.id} mode="employer" />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ReceivedApplicationsPage({ searchParams }: PageProps<"/emploi/candidatures">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Emploi et opportunités", href: href("jobs") }, { label: "Mes offres" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Mes offres et candidatures reçues</h1>
        <ButtonLink href={href("publishJob")} variant="secondary" icon={<Plus aria-hidden className="h-4 w-4" />}>
          Publier une offre
        </ButtonLink>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Employer searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
