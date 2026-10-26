import { z } from "zod";

/**
 * Indicateurs d'exploitation (fonction `ops_metrics`) et seuils d'alerte.
 * Les seuils de volume suivent le forfait gratuit Supabase (base 500 Mo,
 * stockage 1 Go) : à relever avec le forfait réellement souscrit.
 */

export const opsMetricsSchema = z.object({
  database_bytes: z.number(),
  storage: z.record(z.string(), z.object({ objects: z.number(), bytes: z.number() })),
  ai_cost_usd_month: z.number(),
  ai_calls_month: z.number(),
  listings: z.record(z.string(), z.number()),
  moderation_pending: z.number(),
  moderation_oldest_hours: z.number().nullable(),
  reports_open: z.number(),
  appeals_open: z.number(),
  deliveries_pending: z.number(),
  deliveries_failed_24h: z.number(),
  cron_failed_24h: z.number(),
  realtime_partition_today: z.boolean(),
  measured_at: z.string(),
});

export type OpsMetrics = z.infer<typeof opsMetricsSchema>;

export const OPS_LIMITS = {
  databaseBytes: 500 * 1024 ** 2,
  storageBytes: 1024 ** 3,
  /** Part du forfait à partir de laquelle on alerte. */
  usageRatio: 0.8,
  moderationHours: 24,
  deliveriesPending: 200,
};

export interface OpsAlert {
  level: "error" | "warning";
  message: string;
}

export function storageBytes(metrics: OpsMetrics): number {
  return Object.values(metrics.storage).reduce((total, bucket) => total + bucket.bytes, 0);
}

export function opsAlerts(metrics: OpsMetrics, aiBudgetEur?: number): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  if (metrics.cron_failed_24h > 0) alerts.push({ level: "error", message: `${metrics.cron_failed_24h} tâche(s) planifiée(s) en échec sur 24 h (expiration, rappels, purges).` });
  if (metrics.deliveries_failed_24h > 0) alerts.push({ level: "error", message: `${metrics.deliveries_failed_24h} envoi(s) de notification en échec sur 24 h.` });
  if (metrics.deliveries_pending > OPS_LIMITS.deliveriesPending) alerts.push({ level: "warning", message: `${metrics.deliveries_pending} notifications en attente : la tâche d’envoi tourne-t-elle ?` });
  if ((metrics.moderation_oldest_hours ?? 0) > OPS_LIMITS.moderationHours) alerts.push({ level: "warning", message: `Une annonce attend la modération depuis ${metrics.moderation_oldest_hours} h.` });
  if (!metrics.realtime_partition_today) alerts.push({ level: "warning", message: "Temps réel inactif aujourd’hui (partition absente) : les listes se rechargent chaque minute." });
  if (metrics.database_bytes > OPS_LIMITS.databaseBytes * OPS_LIMITS.usageRatio) alerts.push({ level: "warning", message: "Base au-delà de 80 % du forfait." });
  if (storageBytes(metrics) > OPS_LIMITS.storageBytes * OPS_LIMITS.usageRatio) alerts.push({ level: "warning", message: "Stockage au-delà de 80 % du forfait." });
  // Coût de l'IA en dollars, plafond en euros : comparaison indicative (1 $ ≈ 1 €), le coupe-circuit reste dans /admin/ia.
  if (aiBudgetEur && metrics.ai_cost_usd_month > aiBudgetEur * OPS_LIMITS.usageRatio) alerts.push({ level: "warning", message: "Dépense d’IA du mois au-delà de 80 % du plafond." });
  return alerts;
}

const SIZE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${SIZE.format(bytes / 1024)} Ko`;
  if (bytes < 1024 ** 3) return `${SIZE.format(bytes / 1024 ** 2)} Mo`;
  return `${SIZE.format(bytes / 1024 ** 3)} Go`;
}
