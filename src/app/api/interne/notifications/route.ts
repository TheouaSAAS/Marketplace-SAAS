import { timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { dispatchDeliveries, runSearchAlerts } from "@/modules/notifications/server/dispatch";

/**
 * Tâche planifiée (toutes les 10 minutes conseillées) : alertes de recherches
 * dues, puis envoi de la file. Protégée par « Authorization: Bearer
 * <CRON_SECRET> » ; sans secret configuré, elle refuse de s'exécuter.
 */
function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  if (!authorized(request, secret)) return Response.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const alerts = await runSearchAlerts(new Date());
    const deliveries = await dispatchDeliveries(100);
    return Response.json({ alerts, deliveries });
  } catch (error) {
    logger.error("Tâche de notifications en échec", { module: "notifications", error });
    return Response.json({ error: "Tâche en échec." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
