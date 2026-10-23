import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ESSENTIAL_NOTIFICATIONS, channelPreferences } from "@/modules/dashboard/domain/dashboard";
import { MarkReadForm, NotificationPrefsForm } from "@/modules/dashboard/components/dashboard-forms";
import { getPreferences, listNotifications } from "@/modules/dashboard/server/queries";
import { requireAccount } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";

export const metadata: Metadata = { title: "Notifications" };

async function Content() {
  const account = await requireAccount(href("dashboardNotifications"));
  let data;
  try {
    const [notifications, preferences] = await Promise.all([listNotifications(account.id), getPreferences(account.id)]);
    data = { notifications, preferences: channelPreferences(preferences.notification_channels) };
  } catch (error) {
    logger.error("Notifications indisponibles", { module: "tableau-de-bord", error });
    return <ErrorState title="Notifications momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  const unread = data.notifications.filter((item) => !item.read_at).length;
  return (
    <>
      <section aria-labelledby="liste" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="liste" className="text-lg font-bold">
            {unread} non lue{unread > 1 ? "s" : ""}
          </h2>
          {unread > 0 && <MarkReadForm />}
        </div>
        {data.notifications.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucune notification.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {data.notifications.map((notification) => (
              <li key={notification.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span className={notification.read_at ? "" : "font-semibold"}>
                  {!notification.read_at && <span className="sr-only">Non lue : </span>}
                  {notification.link?.startsWith("/") && !notification.link.startsWith("//") ? (
                    <Link href={notification.link} className="underline">
                      {notification.title}
                    </Link>
                  ) : (
                    notification.title
                  )}
                </span>
                <span className="text-xs text-ink-muted">
                  {formatDateTime(notification.created_at)}
                  {notification.body ? ` · ${notification.body}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="preferences" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 id="preferences" className="text-lg font-bold">
          Ce que je veux recevoir
        </h2>
        <p className="text-sm text-ink-muted">
          {ESSENTIAL_NOTIFICATIONS} Chaque e-mail contient un lien pour vous désabonner de sa catégorie, sans connexion. Les alertes de recherche se règlent sur chaque recherche enregistrée.
        </p>
        <NotificationPrefsForm preferences={data.preferences} emailAvailable={isFeatureEnabled("email_notifications")} />
      </section>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Tableau de bord", href: href("dashboard") }, { label: "Notifications" }]} />
      <h1 className="text-3xl font-extrabold">Notifications</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Content />
      </Suspense>
    </>
  );
}
