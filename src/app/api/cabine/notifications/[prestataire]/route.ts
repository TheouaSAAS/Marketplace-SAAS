import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { liveAdapter } from "@/modules/cabin/server/providers";

/**
 * Notifications des prestataires de la cabine (paiement confirmé, échec,
 * code de recharge…). Chaque notification est authentifiée par l'intégration
 * du prestataire (signature) avant tout changement d'état ; une notification
 * rejouée n'a aucun effet (`set_cabin_status`). Sans intégration : 404.
 */
export async function POST(request: Request, context: RouteContext<"/api/cabine/notifications/[prestataire]">) {
  const { prestataire } = await context.params;
  const adapter = liveAdapter(prestataire);
  if (!adapter) return NextResponse.json({ error: { code: "not_found", message: "Prestataire inconnu." } }, { status: 404 });

  const notification = await adapter.verifyNotification(request).catch(() => null);
  if (!notification) {
    logger.warn("Notification de la cabine refusée (signature invalide)", { module: "cabine", prestataire });
    return NextResponse.json({ error: { code: "unauthorized", message: "Signature invalide." } }, { status: 401 });
  }
  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: { code: "unavailable", message: "Service indisponible." } }, { status: 503 });
  const { data: operation } = await admin.from("cabin_operations").select("id, provider_code").eq("reference", notification.reference).maybeSingle();
  if (!operation || operation.provider_code !== adapter.code) {
    return NextResponse.json({ error: { code: "not_found", message: "Opération inconnue." } }, { status: 404 });
  }
  const { error } = await admin.rpc("set_cabin_status", {
    p_operation: operation.id,
    p_status: notification.status,
    p_source: "prestataire",
    p_detail: notification.detail,
    p_provider_reference: notification.providerReference as string,
    p_delivery_code: notification.deliveryCode as string,
  });
  if (error) {
    logger.error("Notification de la cabine non appliquée", { module: "cabine", reference: notification.reference, code: error.code });
    // 409 : le prestataire réessaiera ; l'administration rapproche si besoin.
    return NextResponse.json({ error: { code: "conflict", message: "Transition refusée." } }, { status: 409 });
  }
  return NextResponse.json({ data: { received: true } });
}
