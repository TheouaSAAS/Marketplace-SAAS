import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href, type RouteKey } from "@/config/routes";
import { logger } from "@/lib/logger";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LISTING_STATE_ORDER, LISTING_STATES } from "@/modules/dashboard/domain/dashboard";
import { getOverview, listNotifications, type DashboardNotification, type Overview } from "@/modules/dashboard/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = { title: "Tableau de bord" };

function Tile({ label, value, route, query, hint }: { label: string; value: number; route: RouteKey; query?: Record<string, string>; hint?: string }) {
  return (
    <Link href={href(route, query ? { query } : undefined)} className="flex flex-col gap-0.5 rounded-card border border-border bg-surface p-4 hover:border-brand-600">
      <span className="text-2xl font-extrabold">{value}</span>
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </Link>
  );
}

async function Content() {
  const account = await requireAccount(href("dashboard"));
  let overview: Overview;
  let notifications: DashboardNotification[];
  try {
    [overview, notifications] = await Promise.all([getOverview(account.id), listNotifications(account.id, 5)]);
  } catch (error) {
    logger.error("Tableau de bord indisponible", { module: "tableau-de-bord", error });
    return <ErrorState title="Tableau de bord momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const todo: { text: string; route: RouteKey; query?: Record<string, string> }[] = [];
  if (overview.listings.rejected > 0) todo.push({ text: `${overview.listings.rejected} annonce(s) refusée(s) à corriger`, route: "myListings", query: { statut: "rejected" } });
  if (overview.listings.draft > 0) todo.push({ text: `${overview.listings.draft} brouillon(s) à terminer`, route: "myListings", query: { statut: "draft" } });
  if (overview.listings.expired > 0) todo.push({ text: `${overview.listings.expired} annonce(s) expirée(s) à renouveler ou archiver`, route: "myListings", query: { statut: "expired" } });
  if (overview.unreadMessages > 0) todo.push({ text: `${overview.unreadMessages} message(s) non lu(s)`, route: "messages" });
  if (overview.newContactRequests > 0) todo.push({ text: `${overview.newContactRequests} demande(s) de contact nouvelle(s)`, route: "dashboardActivity" });

  return (
    <>
      <section aria-labelledby="a-faire" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
        <h2 id="a-faire" className="text-lg font-bold">
          À faire
        </h2>
        {todo.length === 0 ? (
          <p className="text-sm text-ink-muted">Rien en attente de votre part.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {todo.map((item) => (
              <li key={item.text}>
                <Link href={href(item.route, item.query ? { query: item.query } : undefined)} className="font-semibold underline">
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="annonces" className="flex flex-col gap-3">
        <h2 id="annonces" className="text-lg font-bold">
          Mes annonces
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LISTING_STATE_ORDER.map((state) => (
            <Tile key={state} label={LISTING_STATES[state].label} value={overview.listings[state]} route="myListings" query={{ statut: state }} />
          ))}
        </div>
      </section>

      <section aria-labelledby="activite" className="flex flex-col gap-3">
        <h2 id="activite" className="text-lg font-bold">
          Activité
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Favoris" value={overview.favorites} route="favorites" />
          <Tile label="Messages non lus" value={overview.unreadMessages} route="messages" />
          <Tile label="Recherches enregistrées" value={overview.savedSearches} route="dashboardActivity" />
          <Tile label="Notifications non lues" value={overview.unreadNotifications} route="dashboardNotifications" />
          <Tile label="Signalements en cours" value={overview.openReports} route="dashboardActivity" hint="Suivi de vos signalements" />
          <Tile label="Demandes reçues" value={overview.newContactRequests} route="dashboardActivity" hint="Contact et devis, nouvelles" />
        </div>
      </section>

      {notifications.length > 0 && (
        <section aria-labelledby="recentes" className="flex flex-col gap-2">
          <h2 id="recentes" className="text-lg font-bold">
            Dernières notifications
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {notifications.map((notification) => (
              <li key={notification.id} className={notification.read_at ? "text-ink-muted" : "font-semibold"}>
                {notification.link?.startsWith("/") && !notification.link.startsWith("//") ? (
                  <Link href={notification.link} className="underline">
                    {notification.title}
                  </Link>
                ) : (
                  notification.title
                )}
              </li>
            ))}
          </ul>
          <Link href={href("dashboardNotifications")} className="text-sm underline">
            Toutes les notifications et préférences
          </Link>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={href("publish")}>Publier une annonce</ButtonLink>
        <ButtonLink href={href("profile")} variant="secondary">
          Mon compte
        </ButtonLink>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Tableau de bord" }]} />
      <h1 className="text-3xl font-extrabold">Tableau de bord</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Content />
      </Suspense>
    </>
  );
}
