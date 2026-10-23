import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { REQUEST_STATUSES, workspaceRights } from "@/modules/businesses/domain/workspace";
import { RequestStatusForm } from "@/modules/businesses/components/pro-forms";
import { loadWorkspace, WorkspaceHeader } from "@/modules/businesses/components/workspace-header";
import { listInbox, type InboxRequest } from "@/modules/businesses/server/workspace";

export const metadata: Metadata = { title: "Espace professionnel — demandes reçues" };

function details(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => typeof item === "string" || typeof item === "number")
    .map(([key, item]) => `${key.replace(/_/g, " ")} : ${item}`);
}

async function Inbox({ params }: { params: Promise<{ id: string }> }) {
  const { id, workspace } = await loadWorkspace(params, "proInbox");
  const rights = workspaceRights(workspace.role);
  if (!rights.canHandleRequests) {
    return (
      <>
        <WorkspaceHeader workspace={workspace} section="Demandes reçues" />
        <EmptyState title="Réservé aux éditeurs" description="Les demandes contiennent les coordonnées des clients : seuls les éditeurs, administrateurs et le titulaire les voient." />
      </>
    );
  }
  let requests: InboxRequest[];
  try {
    requests = await listInbox(id);
  } catch (error) {
    logger.error("Boîte de réception indisponible", { module: "espace-pro", error });
    return <ErrorState title="Demandes momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  const open = requests.filter((request) => request.status === "new" || request.status === "read").length;
  return (
    <>
      <WorkspaceHeader workspace={workspace} section="Demandes reçues" />
      <p className="text-sm text-ink-muted">
        {open} demande{open > 1 ? "s" : ""} à traiter. Les coordonnées sont transmises avec l’accord du client, pour lui répondre seulement. Répondez-lui
        par téléphone ou par la{" "}
        <Link href={href("messages")} className="underline">
          messagerie
        </Link>
        , puis marquez la demande « répondue ».
      </p>
      {requests.length === 0 ? (
        <EmptyState title="Aucune demande" description="Les demandes de devis et de contact envoyées depuis votre page apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={REQUEST_STATUSES[request.status].tone}>{REQUEST_STATUSES[request.status].label}</Badge>
                <span className="text-xs text-ink-muted">
                  {request.kind === "devis" ? "Demande de devis" : "Demande de contact"} · {formatDateTime(request.created_at)}
                </span>
              </div>
              <p className="font-bold">{request.sender_name}</p>
              <p className="text-sm">
                {[request.sender_phone, request.sender_email].filter(Boolean).join(" · ") || "Coordonnées non transmises : répondez par la messagerie."}
              </p>
              <p className="whitespace-pre-line text-sm">{request.message}</p>
              {details(request.details).length > 0 && <p className="text-xs text-ink-muted">{details(request.details).join(" · ")}</p>}
              <RequestStatusForm pageId={id} requestId={request.id} current={request.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function WorkspaceInboxPage({ params }: PageProps<"/espace-pro/[id]/demandes">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Inbox params={params} />
    </Suspense>
  );
}
