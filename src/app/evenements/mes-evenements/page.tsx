import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { eventBadge } from "@/domain/event-timing";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ScheduleForm } from "@/modules/events/components/event-forms";
import { listMyEvents, type ManagedEvent } from "@/modules/events/server/detail";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes événements",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

async function MyEvents({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("myEvents"));
  const proposed = (await searchParams).propose === "1";
  let events: ManagedEvent[];
  try {
    events = await listMyEvents(account.id);
  } catch (error) {
    logger.error("Événements de l'organisateur indisponibles", { module: "evenements", error });
    return <ErrorState title="Vos événements sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  const now = new Date();
  return (
    <div className="flex flex-col gap-4">
      {proposed && (
        <Alert tone="success" title="Proposition envoyée">
          L’équipe de modération la vérifie ; vous serez notifié de sa décision.
        </Alert>
      )}
      {events.length === 0 ? (
        <EmptyState
          title="Aucun événement proposé"
          description="Proposez un événement : il sera publié après vérification."
          action={<ButtonLink href={href("eventPropose")}>Proposer un événement</ButtonLink>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => {
            const timing = eventBadge(new Date(event.starts_at), event.ends_at ? new Date(event.ends_at) : null, event.schedule_status, now);
            const ended = timing.label === "Terminé";
            return (
              <li key={event.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={CONTENT_STATUS_META[event.status].tone}>{CONTENT_STATUS_META[event.status].label}</Badge>
                  <Badge tone={timing.tone}>{timing.label}</Badge>
                </div>
                {event.status === "published" ? (
                  <Link href={href("eventDetail", { params: { slug: event.slug } })} className="font-bold underline">
                    {event.title}
                  </Link>
                ) : (
                  <p className="font-bold">{event.title}</p>
                )}
                <p className="text-sm text-ink-muted">
                  {formatDateTime(event.starts_at)} · {event.category.name}
                </p>
                {event.status === "rejected" && event.rejection_reason && <p className="text-sm text-danger">Motif du refus : {event.rejection_reason}</p>}
                {event.status === "published" && !ended && event.schedule_status !== "cancelled" && (
                  <details className="rounded-control bg-surface-muted p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Reporter ou annuler</summary>
                    <div className="mt-3">
                      <ScheduleForm eventId={event.id} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function MyEventsPage({ searchParams }: PageProps<"/evenements/mes-evenements">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Mes événements" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Mes événements</h1>
        <ButtonLink href={href("eventPropose")} variant="secondary" icon={<Plus aria-hidden className="h-4 w-4" />}>
          Proposer un événement
        </ButtonLink>
      </div>
      <p className="text-sm text-ink-muted">
        Un report ou une annulation reste visible sur la fiche avec votre motif, et les personnes qui ont l’événement en favori sont prévenues.
      </p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <MyEvents searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
