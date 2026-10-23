import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { ReportDecisionForm } from "@/modules/admin/components/back-office-forms";
import { REPORT_STATUSES, REPORT_TARGETS, historyHref, reportTargetHref, stateLabel } from "@/modules/admin/domain/back-office";
import { listReports, type AdminReport } from "@/modules/admin/server/back-office";
import { REPORT_REASONS, type ReportReason } from "@/modules/listings/domain/report-reasons";

export const metadata: Metadata = {
  title: "Signalements — administration",
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  suspendre: "Contenu suspendu : il n’est plus visible, son auteur a reçu le motif et tous les signalements ouverts sur ce contenu sont clos.",
  resolu: "Signalement marqué comme traité.",
  sans_suite: "Signalement classé sans suite.",
  examen: "Signalement pris en charge.",
};

type Raw = Record<string, string | string[] | undefined>;

function ReportCard({ report, open, canSanction }: { report: AdminReport; open: boolean; canSanction: boolean }) {
  const target = REPORT_TARGETS[report.target_type];
  const link = reportTargetHref({ type: report.target_type, slug: report.target_slug, parentType: report.target_parent_type, parentSlug: report.target_parent_slug });
  const history = report.target_id ? historyHref(report.target_type, report.target_id) : null;
  const status = REPORT_STATUSES[report.status];
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{target.label}</Badge>
        <Badge tone={status.tone}>{status.label}</Badge>
        {report.target_reports > 1 && <Badge tone="danger">Signalé {report.target_reports} fois</Badge>}
        {report.target_status && <span className="text-xs text-ink-muted">État du contenu : {stateLabel(report.target_status)}</span>}
      </div>
      <h2 className="font-bold break-words">
        {link ? (
          <Link href={link} className="underline">
            {report.target_title}
          </Link>
        ) : (
          report.target_title
        )}
      </h2>
      <p className="text-sm">
        <span className="font-semibold">{REPORT_REASONS[report.reason as ReportReason] ?? report.reason}</span>
        <span className="text-ink-muted"> · signalé le {formatDateTime(report.created_at)}</span>
      </p>
      {report.details && <p className="whitespace-pre-line rounded-control bg-sand-50 p-3 text-sm">« {report.details} »</p>}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {history && (
          <Link href={history} className="underline">
            Historique du contenu
          </Link>
        )}
        {canSanction && report.target_owner && (
          <Link href={href("adminAccounts", { query: { q: report.target_owner } })} className="underline">
            Compte de l’auteur (sanctions)
          </Link>
        )}
      </p>
      {open ? (
        <ReportDecisionForm reportId={report.id} suspendLabel={target.suspend} reviewing={report.status === "reviewing"} />
      ) : (
        <p className="text-sm text-ink-muted">
          Décision du {report.handled_at ? formatDateTime(report.handled_at) : "—"}
          {report.resolution_note ? ` : « ${report.resolution_note} »` : ""}
        </p>
      )}
    </li>
  );
}

async function Queue({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await teamAccount("adminReports", "staff");
  if (!account) return <AccessDenied audience="staff" />;
  const params = await searchParams;
  const open = params.etat !== "traites";
  const notice = typeof params.decision === "string" ? NOTICES[params.decision] : undefined;
  let reports: AdminReport[];
  try {
    reports = await listReports(open);
  } catch (error) {
    logger.error("File des signalements indisponible", { module: "administration", error });
    return <ErrorState title="File des signalements momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      <nav aria-label="État des signalements" className="flex flex-wrap gap-2">
        {[
          { label: "À traiter", value: undefined, active: open },
          { label: "Traités", value: "traites", active: !open },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={href("adminReports", { query: { etat: tab.value } })}
            aria-current={tab.active ? "page" : undefined}
            className={
              tab.active
                ? "inline-flex min-h-11 items-center rounded-pill bg-brand-600 px-4 text-sm font-semibold text-white"
                : "inline-flex min-h-11 items-center rounded-pill border border-border bg-surface px-4 text-sm font-semibold hover:bg-sand-100"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <EmptyState title={open ? "Aucun signalement à traiter" : "Aucun signalement traité"} description="Les signalements des membres apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} open={open} canSanction={isAdmin(account.role)} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminReportsPage({ searchParams }: PageProps<"/admin/signalements">) {
  return (
    <AdminFrame
      title="Signalements"
      intro="Suspendre retire aussitôt le contenu (refusé avec motif, ou masqué pour un commentaire ou un avis), prévient son auteur et clôt les autres signalements sur ce contenu. L’auteur peut corriger et resoumettre."
    >
      <Queue searchParams={searchParams} />
    </AdminFrame>
  );
}
