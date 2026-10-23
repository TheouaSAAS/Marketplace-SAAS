import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ApplicationStatusForm } from "@/modules/jobs/components/job-forms";
import { listMyApplications, type MyApplication } from "@/modules/jobs/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes candidatures",
  robots: { index: false, follow: false },
};

const STATUS: Record<MyApplication["status"], { label: string; tone: "info" | "neutral" | "success" | "warning" }> = {
  submitted: { label: "Envoyée", tone: "info" },
  viewed: { label: "Vue par l’employeur", tone: "neutral" },
  shortlisted: { label: "Retenue pour la suite", tone: "success" },
  rejected: { label: "Non retenue", tone: "neutral" },
  withdrawn: { label: "Retirée", tone: "warning" },
};

async function Applications() {
  const account = await requireAccount(href("myApplications"));
  let applications: MyApplication[];
  try {
    applications = await listMyApplications(account.id);
  } catch (error) {
    logger.error("Candidatures indisponibles", { module: "emploi", error });
    return <ErrorState title="Vos candidatures sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  if (applications.length === 0) {
    return <EmptyState title="Aucune candidature" description="Candidatez depuis une offre : vous suivrez ici sa réponse." action={<ButtonLink href={href("jobs")}>Voir les offres</ButtonLink>} />;
  }
  return (
    <ul className="flex flex-col gap-3">
      {applications.map((application) => (
        <li key={application.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS[application.status].tone}>{STATUS[application.status].label}</Badge>
            <span className="text-xs text-ink-muted">Envoyée le {formatDateTime(application.created_at)}</span>
          </div>
          {application.listing ? (
            <Link href={href("listingDetail", { params: { slug: application.listing.slug } })} className="font-bold underline">
              {application.listing.title}
            </Link>
          ) : (
            <p className="font-bold">Offre retirée</p>
          )}
          {!["withdrawn", "rejected"].includes(application.status) && <ApplicationStatusForm applicationId={application.id} mode="applicant" />}
        </li>
      ))}
    </ul>
  );
}

export default function MyApplicationsPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Emploi et opportunités", href: href("jobs") }, { label: "Mes candidatures" }]} />
      <h1 className="text-3xl font-extrabold">Mes candidatures</h1>
      <p className="text-sm text-ink-muted">Visibles de vous et de l’employeur seulement. Les décisions sont prises par l’employeur, jamais automatiquement.</p>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <Applications />
      </Suspense>
    </Container>
  );
}
