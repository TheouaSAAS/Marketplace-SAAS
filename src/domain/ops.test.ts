import { describe, expect, it } from "vitest";
import { formatBytes, opsAlerts, opsMetricsSchema, type OpsMetrics } from "./ops";

const healthy: OpsMetrics = opsMetricsSchema.parse({
  database_bytes: 34_000_000,
  storage: { media: { objects: 1, bytes: 3934 } },
  ai_cost_usd_month: 0,
  ai_calls_month: 0,
  listings: { published: 4 },
  moderation_pending: 0,
  moderation_oldest_hours: null,
  reports_open: 0,
  appeals_open: 0,
  deliveries_pending: 0,
  deliveries_failed_24h: 0,
  cron_failed_24h: 0,
  realtime_partition_today: true,
  measured_at: "2026-10-24T14:26:16Z",
});

describe("indicateurs d'exploitation", () => {
  it("ne lève aucune alerte quand tout va bien", () => {
    expect(opsAlerts(healthy, 50)).toEqual([]);
  });

  it("alerte sur les échecs, les attentes longues, le temps réel coupé et les volumes", () => {
    const alerts = opsAlerts(
      { ...healthy, cron_failed_24h: 2, moderation_oldest_hours: 30, realtime_partition_today: false, database_bytes: 450 * 1024 ** 2, ai_cost_usd_month: 45 },
      50,
    );
    expect(alerts.map((alert) => alert.level)).toEqual(["error", "warning", "warning", "warning", "warning"]);
    expect(alerts[0]?.message).toContain("2 tâche(s) planifiée(s)");
  });

  it("présente les volumes en unités lisibles", () => {
    expect(formatBytes(3934)).toBe("3,8 Ko");
    expect(formatBytes(34_000_000)).toBe("32,4 Mo");
  });
});
