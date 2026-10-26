import "server-only";
import { opsMetricsSchema, type OpsMetrics } from "@/domain/ops";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/** Indicateurs d'exploitation (clé secrète du serveur). Null si indisponibles : la page de statut le dit. */
export async function readOpsMetrics(): Promise<OpsMetrics | null> {
  const admin = createAdminSupabaseClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("ops_metrics");
  if (error) {
    logger.warn("Indicateurs d'exploitation indisponibles", { module: "observabilite", code: error.code });
    return null;
  }
  const parsed = opsMetricsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
