import "server-only";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { clientIp, fingerprint } from "./rate-limit";

/**
 * Journal des accès à l'administration (`admin_access_log`) : connexions,
 * échecs, refus, second facteur, déconnexions. Écrit par le serveur seul ;
 * l'adresse visée et l'IP ne sont conservées que sous forme d'empreintes.
 * Jamais de mot de passe, de code ni de jeton.
 */

export type AdminAccessEvent = "connexion" | "echec" | "refus" | "second_facteur_echec" | "second_facteur_active" | "deconnexion";

/** Au-delà, une série d'échecs sur une même adresse est signalée dans les journaux (alerte). */
const REPEATED_FAILURES = 3;

export async function logAdminAccess(event: AdminAccessEvent, subject: { userId?: string; email?: string }): Promise<void> {
  const admin = createAdminSupabaseClient();
  const ip = await clientIp();
  const emailFingerprint = subject.email ? fingerprint(["admin-acces", "email", subject.email.toLowerCase()]) : null;
  logger.info("Accès à l'administration", { module: "administration", event, userId: subject.userId });
  if (!admin) return;
  const { error } = await admin.from("admin_access_log").insert({
    event,
    user_id: subject.userId ?? null,
    email_fingerprint: emailFingerprint,
    ip_fingerprint: fingerprint(["admin-acces", "ip", ip]),
  });
  if (error) {
    logger.warn("Accès à l'administration non journalisé", { module: "administration", code: error.code });
    return;
  }
  if (event === "echec" && emailFingerprint) {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("admin_access_log")
      .select("id", { count: "exact", head: true })
      .eq("email_fingerprint", emailFingerprint)
      .eq("event", "echec")
      .gte("created_at", since);
    if ((count ?? 0) >= REPEATED_FAILURES) logger.warn("Échecs répétés de connexion à l'administration", { module: "administration", echecs: count });
  }
}
