import { connection } from "next/server";
import { apiData } from "@/lib/api";
import { checkDatabase } from "@/server/diagnostics";

/**
 * Sonde de disponibilité RÉELLE pour la supervision externe (UptimeRobot,
 * Better Stack…) : 200 si la base répond, 503 sinon. Distincte de /api/health
 * (le processus répond), pour qu'une panne de la base n'entraîne pas de
 * redémarrages inutiles chez l'hébergeur. Aucun détail de configuration exposé.
 */
export async function GET() {
  await connection();
  const database = await checkDatabase();
  const ready = database.status === "ok";
  return apiData(
    { status: ready ? "ok" : "degraded", database: database.status, time: new Date().toISOString() },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
