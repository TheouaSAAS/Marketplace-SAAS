import type { Metadata } from "next";
import { Suspense } from "react";
import { formatDate, formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { PRO_BADGES } from "@/modules/businesses/domain/pro";
import { workspaceRights } from "@/modules/businesses/domain/workspace";
import { VerificationRequestForm } from "@/modules/businesses/components/pro-forms";
import { loadWorkspace, WorkspaceHeader } from "@/modules/businesses/components/workspace-header";
import { getModerationHistory, listVerificationRequests } from "@/modules/businesses/server/workspace";

export const metadata: Metadata = { title: "Espace professionnel — vérification et modération" };

const STATUS_WORDS: Record<string, string> = { draft: "brouillon", pending: "en attente", published: "publiée", rejected: "refusée", expired: "expirée", archived: "archivée" };
const REQUEST_STATUS = { pending: { label: "En cours", tone: "info" }, approved: { label: "Validée", tone: "success" }, rejected: { label: "Refusée", tone: "danger" } } as const;

async function Verification({ params }: { params: Promise<{ id: string }> }) {
  const { id, workspace } = await loadWorkspace(params, "proModeration");
  let data;
  try {
    const [requests, history] = await Promise.all([listVerificationRequests(id), getModerationHistory(id)]);
    data = { requests, history };
  } catch (error) {
    logger.error("Vérification de l’espace pro indisponible", { module: "espace-pro", error });
    return <ErrorState title="Page momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const { page } = workspace;
  const rights = workspaceRights(workspace.role);
  const canRequest = rights.canManageListings && page.status === "published" && page.verification_status !== "verified" && !workspace.verificationPending;
  return (
    <>
      <WorkspaceHeader workspace={workspace} section="Vérification et modération" />
      <section aria-labelledby="verification" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 id="verification" className="text-lg font-bold">
          Vérification
        </h2>
        <p className="text-sm text-ink-muted">{PRO_BADGES.verified.definition}</p>
        {page.verification_status === "verified" && page.verified_at && <p className="text-sm text-success">Page vérifiée le {formatDate(page.verified_at)}.</p>}
        {canRequest && <VerificationRequestForm pageId={id} />}
        {!canRequest && page.status !== "published" && <p className="text-sm text-ink-muted">La vérification se demande une fois la page publiée.</p>}
        {data.requests.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {data.requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-0.5 rounded-control border border-border p-3">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={REQUEST_STATUS[request.status].tone}>{REQUEST_STATUS[request.status].label}</Badge>
                  <span className="text-xs text-ink-muted">Demandée le {formatDateTime(request.created_at)}</span>
                </span>
                <span>Élément proposé : {request.evidence}</span>
                {request.decision_note && <span className="text-ink-muted">Réponse de l’équipe locale : {request.decision_note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="moderation" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 id="moderation" className="text-lg font-bold">
          Historique de modération
        </h2>
        <p className="text-sm text-ink-muted">Changements de statut de la page et de ses annonces, avec les corrections demandées par l’équipe.</p>
        {data.history.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun changement enregistré.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {data.history.map((entry) => (
              <li key={`${entry.changed_at}-${entry.title}-${entry.status_after}`}>
                <span className="text-ink-muted">{formatDateTime(entry.changed_at)}</span> — {entry.entity === "page" ? "Page" : "Annonce"} « {entry.title ?? "sans titre"} » :{" "}
                {STATUS_WORDS[entry.status_before ?? ""] ?? "création"} → {STATUS_WORDS[entry.status_after ?? ""] ?? entry.status_after}
                {entry.reason && <span className="text-danger"> · correction demandée : {entry.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function WorkspaceVerificationPage({ params }: PageProps<"/espace-pro/[id]/verification">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Verification params={params} />
    </Suspense>
  );
}
