import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { historyHref } from "@/modules/admin/domain/back-office";
import { DecideAppealForm } from "@/modules/appeals/components/appeal-forms";
import { APPEAL_STATUSES, APPEAL_TARGETS } from "@/modules/appeals/domain/appeals";
import { listAppeals, type AdminAppeal } from "@/modules/appeals/server/queries";

export const metadata: Metadata = {
  title: "Recours — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

async function Appeals({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await teamAccount("adminAppeals", "staff");
  if (!account) return <AccessDenied audience="staff" />;
  const pending = (await searchParams).etat !== "tranches";
  let appeals: AdminAppeal[];
  try {
    appeals = await listAppeals(pending);
  } catch (error) {
    logger.error("Recours indisponibles", { module: "administration", error });
    return <ErrorState title="Recours momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="État des recours" className="flex flex-wrap gap-2">
        {[
          { label: "À trancher", value: undefined, active: pending },
          { label: "Tranchés", value: "tranches", active: !pending },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={href("adminAppeals", { query: { etat: tab.value } })}
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
      {appeals.length === 0 ? (
        <EmptyState title={pending ? "Aucun recours à trancher" : "Aucun recours tranché"} description="Les contestations des auteurs apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-4">
          {appeals.map((appeal) => {
            const history = appeal.target_type === "account" ? null : historyHref(appeal.target_type, appeal.target_id);
            return (
              <li key={appeal.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{APPEAL_TARGETS[appeal.target_type]}</Badge>
                  <Badge tone={APPEAL_STATUSES[appeal.status].tone}>{APPEAL_STATUSES[appeal.status].label}</Badge>
                  <span className="text-xs text-ink-muted">déposé le {formatDateTime(appeal.created_at)} par {appeal.author_name ?? "un membre"}</span>
                </div>
                <h2 className="font-bold break-words">{appeal.title}</h2>
                <p className="whitespace-pre-line rounded-control bg-sand-50 p-3 text-sm">« {appeal.message} »</p>
                <p className="flex flex-wrap gap-x-4 text-sm">
                  {history && (
                    <Link href={history} className="underline">
                      Historique et motif de la décision
                    </Link>
                  )}
                  {isAdmin(account.role) && (
                    <Link href={href("adminAccounts", { query: { q: appeal.user_id } })} className="underline">
                      Compte de l’auteur
                    </Link>
                  )}
                </p>
                {appeal.status === "pending" ? (
                  appeal.target_type === "account" && !isAdmin(account.role) ? (
                    <p className="text-sm text-ink-muted">La réactivation d’un compte est décidée par un administrateur.</p>
                  ) : (
                    <DecideAppealForm appealId={appeal.id} />
                  )
                ) : (
                  <p className="text-sm text-ink-muted">
                    Décision du {appeal.decided_at ? formatDateTime(appeal.decided_at) : "—"} : « {appeal.decision_note} »
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminAppealsPage({ searchParams }: PageProps<"/admin/recours">) {
  return (
    <AdminFrame
      title="Recours"
      intro="Les auteurs contestent un refus, une suspension ou un masquage. Accepter renvoie le contenu en relecture (ou le rétablit) ; chaque décision est motivée, notifiée et journalisée."
    >
      <Appeals searchParams={searchParams} />
    </AdminFrame>
  );
}
