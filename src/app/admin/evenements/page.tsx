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
import { ModerationForm } from "@/modules/events/components/event-forms";
import { listPendingEvents } from "@/modules/events/server/detail";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Événements à modérer — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const DECISIONS: Record<string, string> = {
  publie: "Événement publié : l’organisateur est notifié.",
  refuse: "Événement refusé : l’organisateur reçoit votre motif.",
};

/** Équipe de modération : l'interface le vérifie, la base le garantit. */
async function ModerationQueue({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("adminEvents"));
  if (!isStaff(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe de modération.
      </Alert>
    );
  }
  const decision = (await searchParams).decision;
  const notice = typeof decision === "string" ? DECISIONS[decision] : undefined;
  let events: Awaited<ReturnType<typeof listPendingEvents>>;
  try {
    events = await listPendingEvents();
  } catch (error) {
    logger.error("File de modération indisponible", { module: "evenements", error });
    return <ErrorState title="File de modération momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {events.length === 0 ? (
        <EmptyState title="Aucun événement en attente" description="Les nouvelles propositions apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-4">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <h2 className="font-bold">{event.title}</h2>
              <p className="text-sm text-ink-muted">
                {formatDateTime(event.starts_at)} · {event.category.name} · organisé par {event.organizer_name ?? "non précisé"} · proposé le{" "}
                {formatDateTime(event.created_at)}
              </p>
              <p className="whitespace-pre-line text-sm">{event.description}</p>
              <p className="text-xs text-ink-muted">Vérifiez que l’événement est réel, daté et sans coordonnées trompeuses avant de publier.</p>
              <ModerationForm eventId={event.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminEventsPage({ searchParams }: PageProps<"/admin/evenements">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Administration", href: href("admin") }, { label: "Événements à modérer" }]} />
      <h1 className="text-3xl font-extrabold">Événements à modérer</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ModerationQueue searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
