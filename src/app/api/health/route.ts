import { connection } from "next/server";
import { apiData } from "@/lib/api";

/**
 * Sonde de disponibilité pour l'hébergeur et la supervision.
 * Volontairement minimale : aucune information de configuration n'est exposée
 * (le détail est réservé à la page /interne/statut).
 */
export async function GET() {
  await connection();
  return apiData({ status: "ok", time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
