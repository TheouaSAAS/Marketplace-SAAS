import type { Metadata } from "next";
import { Suspense } from "react";
import { logger } from "@/lib/logger";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { PRIVACY_NOTE, PRO_STATS_DEFINITIONS } from "@/modules/businesses/domain/workspace";
import { loadWorkspace, WorkspaceHeader } from "@/modules/businesses/components/workspace-header";
import { getWorkspaceStats, type ProStats } from "@/modules/businesses/server/workspace";

export const metadata: Metadata = { title: "Espace professionnel — statistiques" };

function rows(stats: ProStats): { key: keyof typeof PRO_STATS_DEFINITIONS; value: string }[] {
  return [
    { key: "pageViews", value: String(stats.page_views) },
    { key: "pageFavorites", value: String(stats.page_favorites) },
    { key: "requests", value: `${stats.requests_total} (dont ${stats.requests_30d} sur 30 jours)` },
    { key: "unanswered", value: String(stats.requests_unanswered) },
    { key: "conversations", value: String(stats.conversations) },
    { key: "reviews", value: stats.rating_average === null ? String(stats.reviews_published) : `${stats.reviews_published} · moyenne ${stats.rating_average.toLocaleString("fr-FR")}/5` },
    { key: "listingViews", value: String(stats.listing_views) },
    { key: "listingFavorites", value: String(stats.listing_favorites) },
    { key: "listingContacts", value: String(stats.listing_contact_reveals) },
  ];
}

async function Stats({ params }: { params: Promise<{ id: string }> }) {
  const { id, workspace } = await loadWorkspace(params, "proStats");
  let stats: ProStats | null;
  try {
    stats = await getWorkspaceStats(id);
  } catch (error) {
    logger.error("Statistiques de l’espace pro indisponibles", { module: "espace-pro", error });
    return <ErrorState title="Statistiques momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <>
      <WorkspaceHeader workspace={workspace} section="Statistiques" />
      <p className="rounded-control bg-sand-50 p-3 text-sm">{PRIVACY_NOTE}</p>
      {stats && (
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows(stats).map((row) => (
            <div key={row.key} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
              <dt className="text-sm font-semibold">{PRO_STATS_DEFINITIONS[row.key].label}</dt>
              <dd className="text-2xl font-extrabold">{row.value}</dd>
              <dd className="text-xs text-ink-muted">{PRO_STATS_DEFINITIONS[row.key].definition}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-ink-muted">Totaux depuis la création de la page ; ils décrivent une tendance, pas une audience exacte. Aucun classement entre professionnels.</p>
    </>
  );
}

export default function WorkspaceStatsPage({ params }: PageProps<"/espace-pro/[id]/statistiques">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Stats params={params} />
    </Suspense>
  );
}
