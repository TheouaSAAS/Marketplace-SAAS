import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { formatBytes, OPS_LIMITS, opsAlerts, storageBytes, type OpsMetrics } from "@/domain/ops";

const NUMBER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Volumes (coûts), files d'attente et alertes, pour la page de statut interne. */
export function OpsCard({ metrics, aiBudgetEur }: { metrics: OpsMetrics | null; aiBudgetEur?: number }) {
  if (!metrics) {
    return (
      <Card>
        <CardBody>
          <CardTitle>Exploitation</CardTitle>
          <p className="text-sm text-ink-muted">Indicateurs indisponibles (clé secrète absente ou base injoignable).</p>
        </CardBody>
      </Card>
    );
  }
  const alerts = opsAlerts(metrics, aiBudgetEur);
  const rows: [string, string][] = [
    ["Base de données", `${formatBytes(metrics.database_bytes)} sur ${formatBytes(OPS_LIMITS.databaseBytes)} (forfait gratuit)`],
    ["Stockage des fichiers", `${formatBytes(storageBytes(metrics))} sur ${formatBytes(OPS_LIMITS.storageBytes)}`],
    ["IA ce mois", `${metrics.ai_calls_month} appel(s), ${NUMBER.format(metrics.ai_cost_usd_month)} $${aiBudgetEur ? ` (plafond ${aiBudgetEur} €)` : ""}`],
    ["Annonces", Object.entries(metrics.listings).map(([status, count]) => `${status} : ${count}`).join(" · ") || "aucune"],
    ["À modérer", `${metrics.moderation_pending}${metrics.moderation_oldest_hours !== null ? ` (la plus ancienne : ${metrics.moderation_oldest_hours} h)` : ""}`],
    ["Signalements et recours ouverts", `${metrics.reports_open} · ${metrics.appeals_open}`],
    ["Notifications en attente / en échec (24 h)", `${metrics.deliveries_pending} / ${metrics.deliveries_failed_24h}`],
    ["Tâches planifiées en échec (24 h)", String(metrics.cron_failed_24h)],
    ["Temps réel", metrics.realtime_partition_today ? "actif" : "inactif (rechargement chaque minute)"],
  ];
  return (
    <Card>
      <CardBody>
        <CardTitle>Exploitation</CardTitle>
        {alerts.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {alerts.map((alert) => (
              <li key={alert.message} className="flex items-start gap-2 text-sm">
                <Badge tone={alert.level === "error" ? "danger" : "warning"}>{alert.level === "error" ? "Alerte" : "À surveiller"}</Badge>
                {alert.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-success">Aucune alerte.</p>
        )}
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
