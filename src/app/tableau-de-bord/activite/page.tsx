import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { formatDate, formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { REPORT_REASONS } from "@/modules/listings/domain/report-reasons";
import { DeletePlanForm } from "@/modules/newcomer/components/plan-actions";
import { answersToSearchParams } from "@/modules/newcomer/domain/answers";
import { getSavedNewcomerAnswers } from "@/modules/newcomer/server/queries";
import { DeleteSavedSearchForm } from "@/modules/search/components/saved-search-forms";
import { listSavedSearches } from "@/modules/search/server/saved";
import { getOverview, listMyContactRequests, listMyReports, type MyReport } from "@/modules/dashboard/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = { title: "Favoris, recherches et échanges" };

const REPORT_STATUS: Record<MyReport["status"], { label: string; tone: "info" | "neutral" | "success" | "warning" }> = {
  open: { label: "Reçu", tone: "info" },
  reviewing: { label: "En cours d’examen", tone: "warning" },
  resolved: { label: "Traité", tone: "success" },
  dismissed: { label: "Classé sans suite", tone: "neutral" },
};
const REQUEST_STATUS = { new: "Nouvelle", read: "Lue", replied: "Répondue", archived: "Archivée" } as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function reportTarget(report: MyReport): { label: string; href: string | null } {
  if (report.listing) return { label: report.listing.title, href: href("listingDetail", { params: { slug: report.listing.slug } }) };
  if (report.place) return { label: report.place.name, href: href("placeDetail", { params: { slug: report.place.slug } }) };
  if (report.event) return { label: report.event.title, href: href("eventDetail", { params: { slug: report.event.slug } }) };
  if (report.business) return { label: report.business.name, href: href("professionalDetail", { params: { slug: report.business.slug } }) };
  return { label: "Contenu retiré ou commentaire", href: null };
}

async function Content() {
  const account = await requireAccount(href("dashboardActivity"));
  let data;
  try {
    const [overview, savedSearches, newcomer, reports, requests] = await Promise.all([
      getOverview(account.id),
      listSavedSearches(),
      getSavedNewcomerAnswers(),
      listMyReports(account.id),
      listMyContactRequests(account.id),
    ]);
    data = { overview, savedSearches, newcomer, reports, requests };
  } catch (error) {
    logger.error("Activité indisponible", { module: "tableau-de-bord", error });
    return <ErrorState title="Activité momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const { overview, savedSearches, newcomer, reports, requests } = data;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Section id="favoris" title={`Favoris (${overview.favorites})`}>
          <p className="text-sm text-ink-muted">Annonces, lieux et événements que vous suivez. Privés : personne d’autre ne les voit.</p>
          <ButtonLink href={href("favorites")} variant="secondary">
            Voir mes favoris
          </ButtonLink>
        </Section>
        <Section id="messages" title={`Messages (${overview.unreadMessages} non lu${overview.unreadMessages > 1 ? "s" : ""})`}>
          <p className="text-sm text-ink-muted">Conversations avec les annonceurs, organisateurs et professionnels.</p>
          <ButtonLink href={href("messages")} variant="secondary">
            Ouvrir la messagerie
          </ButtonLink>
        </Section>
      </div>

      <Section id="recherches" title="Mes recherches enregistrées">
        {savedSearches.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border">
            {savedSearches.map((saved) => (
              <li key={saved.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Link href={`${href("search")}?${saved.query}`} className="block truncate font-semibold text-brand-700 hover:underline">
                    {saved.name}
                  </Link>
                  <p className="text-xs text-ink-muted">Enregistrée le {formatDate(saved.createdAt)}</p>
                </div>
                <DeleteSavedSearchForm id={saved.id} name={saved.name} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            Aucune recherche enregistrée. Depuis la{" "}
            <Link href={href("search")} className="font-semibold text-brand-700 underline">
              recherche
            </Link>
            , utilisez « Enregistrer cette recherche ».
          </p>
        )}
        <p className="text-xs text-ink-muted">Les alertes de nouveaux résultats arriveront avec le centre de notifications.</p>
      </Section>

      <Section id="parcours" title="Mon parcours « Nouveau à San Pedro ? »">
        {newcomer ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">Enregistré le {formatDate(newcomer.updatedAt)}.</p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href={`${href("newcomerPlan")}?${answersToSearchParams(newcomer.answers).toString()}`} variant="secondary">
                Voir mon plan
              </ButtonLink>
              <DeletePlanForm returnTo="tableau-de-bord" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink-muted">Aucun parcours enregistré.</p>
            <ButtonLink href={href("newcomer")} variant="secondary">
              Commencer le parcours
            </ButtonLink>
          </div>
        )}
      </Section>

      <Section id="demandes" title="Demandes de contact et de devis">
        {requests.received.length + requests.sent.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucune demande envoyée ni reçue.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Reçues", requests.received],
                ["Envoyées", requests.sent],
              ] as const
            ).map(([label, items]) => (
              <div key={label} className="flex flex-col gap-1 text-sm">
                <p className="font-semibold">
                  {label} ({items.length})
                </p>
                <ul className="flex flex-col gap-1">
                  {items.slice(0, 10).map((request) => (
                    <li key={request.id} className="text-ink-muted">
                      {request.kind === "devis" ? "Devis" : "Contact"} · {request.business?.name ?? request.listing?.title ?? "—"} · {REQUEST_STATUS[request.status]} ·{" "}
                      {formatDate(request.created_at)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <Link href={href("quoteRequests")} className="text-sm font-semibold underline">
          Suivre mes demandes de devis
        </Link>
      </Section>

      <Section id="signalements" title="Mes signalements">
        {reports.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun signalement. Utilisez « Signaler » sur un contenu qui vous semble problématique.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {reports.map((report) => {
              const target = reportTarget(report);
              return (
                <li key={report.id} className="flex flex-col gap-0.5 rounded-control border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={REPORT_STATUS[report.status].tone}>{REPORT_STATUS[report.status].label}</Badge>
                    <span className="text-xs text-ink-muted">{formatDateTime(report.created_at)}</span>
                  </div>
                  <p>
                    {target.href ? (
                      <Link href={target.href} className="font-semibold underline">
                        {target.label}
                      </Link>
                    ) : (
                      target.label
                    )}{" "}
                    · {REPORT_REASONS[report.reason as keyof typeof REPORT_REASONS] ?? report.reason}
                  </p>
                  {report.resolution_note && <p className="text-ink-muted">Réponse de l’équipe : {report.resolution_note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

export default function ActivityPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Tableau de bord", href: href("dashboard") }, { label: "Favoris et échanges" }]} />
      <h1 className="text-3xl font-extrabold">Favoris, recherches et échanges</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Content />
      </Suspense>
    </>
  );
}
