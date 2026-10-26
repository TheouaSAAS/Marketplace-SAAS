import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import packageJson from "../../../../package.json";
import { FEATURE_KEYS, FEATURES } from "@/config/feature-flags";
import { APP_ENVIRONMENTS, resolveAppEnvironment } from "@/config/environment";
import { ROUTES, type AppRoute } from "@/config/routes";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Spinner } from "@/components/ui/spinner";
import { checkDatabase, describeServices, environmentPresence, type CheckStatus, type ServiceCheck } from "@/server/diagnostics";
import { getFeatureStates, requirementLabel } from "@/server/features";
import { readOpsMetrics } from "@/server/ops-metrics";
import { getServerEnv } from "@/lib/env.server";
import { OpsCard } from "@/components/layout/ops-card";
import { canViewInternalStatus } from "@/server/internal-access";

export const metadata: Metadata = {
  title: "Statut interne",
  robots: { index: false, follow: false },
};

const STATUS_BADGE: Record<CheckStatus, { tone: BadgeTone; label: string }> = {
  ok: { tone: "success", label: "Opérationnel" },
  partial: { tone: "warning", label: "Configuré, à vérifier" },
  simulated: { tone: "info", label: "Simulé (développement)" },
  not_configured: { tone: "neutral", label: "Non configuré" },
  error: { tone: "danger", label: "En erreur" },
};

function ServiceRow({ check }: { check: ServiceCheck }) {
  const badge = STATUS_BADGE[check.status];
  return (
    <li className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:items-start sm:gap-4">
      <span className="w-56 shrink-0 font-semibold">{check.name}</span>
      <Badge tone={badge.tone} className="self-start">
        {badge.label}
      </Badge>
      <span className="text-sm text-ink-muted">{check.detail}</span>
    </li>
  );
}

async function StatusContent({ searchParams }: Pick<PageProps<"/interne/statut">, "searchParams">) {
  const { token } = await searchParams;
  // Accès refusé : 404 pour ne pas révéler l'existence de la page.
  if (!canViewInternalStatus(typeof token === "string" ? token : undefined)) notFound();
  await connection();

  const [database, services, features, env, metrics] = [await checkDatabase(), describeServices(), getFeatureStates(), environmentPresence(), await readOpsMetrics()];
  const routes = Object.values(ROUTES as Record<string, AppRoute>);
  const environment = resolveAppEnvironment();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA;
  const live = routes.filter((route) => route.status === "live");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <CardTitle>Application</CardTitle>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-muted">Version</dt>
            <dd>{packageJson.version}</dd>
            <dt className="text-ink-muted">Environnement</dt>
            <dd>
              {APP_ENVIRONMENTS[environment]} (<code>{environment}</code>, build {process.env.NODE_ENV})
            </dd>
            <dt className="text-ink-muted">Commit déployé</dt>
            <dd>{commit ? <code>{commit.slice(0, 12)}</code> : "non renseigné (GIT_COMMIT_SHA)"}</dd>
            <dt className="text-ink-muted">Accès</dt>
            <dd>{process.env.SITE_ACCESS_CODE ? "réservé (code d’accès actif)" : "ouvert à tous"}</dd>
            <dt className="text-ink-muted">Node.js</dt>
            <dd>{process.versions.node}</dd>
            <dt className="text-ink-muted">Pages publiées</dt>
            <dd>
              {live.length} sur {routes.length} routes déclarées
            </dd>
          </dl>
        </CardBody>
      </Card>

      <OpsCard metrics={metrics} aiBudgetEur={getServerEnv().AI_MONTHLY_BUDGET_EUR} />

      <Card>
        <CardBody>
          <CardTitle>Services</CardTitle>
          <ul>
            {[database, ...services].map((check) => (
              <ServiceRow key={check.name} check={check} />
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle>Fonctionnalités (drapeaux)</CardTitle>
          <p className="text-sm text-ink-muted">
            Active = demandée et toutes ses dépendances configurées. Forçage : variable <code>FEATURE_&lt;CLÉ&gt;=on|off</code>.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {FEATURE_KEYS.map((key) => {
              const state = features[key];
              return (
                <li key={key} className="flex flex-col gap-1 rounded-control border border-border p-3">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{FEATURES[key].label}</span>
                    <Badge tone={state.enabled ? "success" : "neutral"}>{state.enabled ? "Active" : "Inactive"}</Badge>
                  </span>
                  <span className="text-xs text-ink-muted">
                    <code>{key}</code> · {state.requested ? "demandée" : "non demandée"}
                    {state.missing.length > 0 && ` · manque : ${state.missing.map(requirementLabel).join(", ")}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle>Variables d’environnement</CardTitle>
          <p className="text-sm text-ink-muted">Présence uniquement ; les valeurs ne sont jamais affichées.</p>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {env.map((variable) => (
              <li key={variable.name} className="flex items-center justify-between gap-2 border-b border-border py-1.5">
                <code className="truncate">{variable.name}</code>
                <span className={variable.present ? "font-semibold text-success" : "text-ink-subtle"}>
                  {variable.present ? "renseignée" : "absente"}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

/** Page interne : état réel des services, drapeaux et configuration. Non indexée, protégée par jeton. */
export default function InternalStatusPage({ searchParams }: PageProps<"/interne/statut">) {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">Statut interne</h1>
        <Alert tone="info">Page réservée à l’équipe technique. Ne pas partager son adresse ni son jeton.</Alert>
      </header>
      <Suspense fallback={<Spinner size="lg" label="Vérification des services" />}>
        <StatusContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
