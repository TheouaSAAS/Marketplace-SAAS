import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isAdmin, ROLE_LABELS } from "@/domain/roles";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AccessDenied } from "@/modules/admin/components/admin-frame";
import { PUBLICATION_WORKFLOW, sectionsFor, type Overview } from "@/modules/admin/domain/back-office";
import { getDeliveryStats, getOverview, type DeliveryStats } from "@/modules/admin/server/back-office";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

const DELIVERY_LABELS = { sent: "Envoyés", simulated: "Simulés", pending: "En attente", skipped: "Ignorés", failed: "En échec" } as const;

async function Dashboard() {
  const account = await requireAccount(href("admin"));
  const sections = sectionsFor(account.role);
  if (sections.length === 0) return <AccessDenied audience="team" />;
  let counts: Overview | null = null;
  let deliveries: DeliveryStats | null = null;
  try {
    [counts, deliveries] = await Promise.all([getOverview(), isAdmin(account.role) ? getDeliveryStats() : Promise.resolve(null)]);
  } catch (error) {
    logger.error("Tableau de bord d'administration indisponible", { module: "administration", error });
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-ink-muted">
        Connecté en tant que <Badge tone="brand">{ROLE_LABELS[account.role]}</Badge> : seuls les outils de votre rôle sont affichés. Chaque décision sensible est
        journalisée avec son auteur, sa date, sa raison et l’état avant et après.
      </p>
      {!counts && <Alert tone="warning">Les volumes en attente sont momentanément indisponibles ; les outils restent accessibles.</Alert>}

      {sections.map((section) => (
        <section key={section.title} aria-labelledby={`section-${section.title}`} className="flex flex-col gap-3">
          <h2 id={`section-${section.title}`} className="text-xl font-bold">
            {section.title}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {section.tools.map((tool) => (
              <li key={tool.route} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                <Link href={href(tool.route)} className="font-bold underline">
                  {tool.label}
                </Link>
                <p className="text-sm text-ink-muted">{tool.description}</p>
                {counts && tool.counts && (
                  <p className="flex flex-wrap gap-2">
                    {tool.counts.map((count) => (
                      <Badge key={count.key} tone={counts[count.key] > 0 ? "warning" : "neutral"}>
                        {counts[count.key]} {count.label}
                      </Badge>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {deliveries && (
        <section aria-labelledby="envois" className="flex flex-col gap-2">
          <h2 id="envois" className="text-xl font-bold">
            Envois de notifications (7 jours)
          </h2>
          <p className="flex flex-wrap gap-2 text-sm">
            {(["sent", "simulated", "pending", "skipped", "failed"] as const).map((status) => (
              <Badge key={status} tone={status === "failed" && (deliveries.counts[status] ?? 0) > 0 ? "danger" : "neutral"}>
                {DELIVERY_LABELS[status]} : {deliveries.counts[status] ?? 0}
              </Badge>
            ))}
          </p>
          {deliveries.recentErrors.length > 0 && (
            <p className="text-sm text-ink-muted">Causes : {deliveries.recentErrors.map((item) => `${item.error} (${item.count})`).join(", ")}.</p>
          )}
          <p className="text-xs text-ink-muted">« Ignoré » : canal désactivé, aucun fournisseur ou adresse absente. « Simulé » : affiché dans la console en développement.</p>
        </section>
      )}

      <section aria-labelledby="cycle" className="flex flex-col gap-3">
        <h2 id="cycle" className="text-xl font-bold">
          Cycle de publication
        </h2>
        <ol className="grid gap-2 sm:grid-cols-5">
          {PUBLICATION_WORKFLOW.map((step, index) => (
            <li key={step.status} className="rounded-card border border-border bg-surface p-3 text-sm">
              <p className="font-semibold">
                {index + 1}. {step.status}
              </p>
              <p className="text-ink-muted">{step.explain}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-ink-muted">
          L’intelligence artificielle ne décide jamais : les champs qu’elle a proposés sont signalés dans les files, et c’est toujours une personne de l’équipe qui
          publie, refuse ou suspend.
        </p>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Container className="flex max-w-5xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Administration" }]} />
      <h1 className="text-3xl font-extrabold">Administration</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Dashboard />
      </Suspense>
    </Container>
  );
}
