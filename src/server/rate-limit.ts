import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Limitation de débit des actions sensibles (inscription, connexion,
 * réinitialisation, contact…). Les compteurs sont en base (partagés entre
 * instances) ; les clés sont des empreintes HMAC : aucune adresse IP ni
 * adresse e-mail n'est stockée en clair.
 */

export interface RateRule {
  /** Nombre d'essais autorisés dans la fenêtre. */
  limit: number;
  windowSeconds: number;
}

export const RATE_RULES = {
  signUp: { limit: 5, windowSeconds: 3600 },
  signIn: { limit: 10, windowSeconds: 900 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  sensitiveAccountAction: { limit: 10, windowSeconds: 3600 },
  listingDraft: { limit: 20, windowSeconds: 86400 },
  aiAssist: { limit: 30, windowSeconds: 86400 },
  aiAssistant: { limit: 20, windowSeconds: 3600 },
  aiSearch: { limit: 40, windowSeconds: 86400 },
  siteAccess: { limit: 10, windowSeconds: 900 },
  /** Renvoi de l'e-mail de confirmation : 3 par heure (le fournisseur limite aussi ses envois). */
  confirmationResend: { limit: 3, windowSeconds: 3600 },
  /** Connexion à l'administration : plus stricte que la connexion des membres. */
  adminSignIn: { limit: 5, windowSeconds: 900 },
  secondFactor: { limit: 10, windowSeconds: 900 },
  /** Cabine : récapitulatifs (calcul des frais) et opérations confirmées (par IP et par destinataire). */
  cabinQuote: { limit: 60, windowSeconds: 3600 },
  cabinOperation: { limit: 10, windowSeconds: 3600 },
} as const satisfies Record<string, RateRule>;

export type RateAction = keyof typeof RATE_RULES;

export async function clientIp(): Promise<string> {
  const store = await headers();
  return store.get("x-forwarded-for")?.split(",")[0]?.trim() || store.get("x-real-ip")?.trim() || "inconnue";
}

/** Empreinte HMAC (clé secrète du serveur) : regroupe des événements sans conserver la donnée en clair. */
export function fingerprint(parts: string[]): string {
  const secret = getServerEnv().SUPABASE_SECRET_KEY ?? "developpement-sans-cle";
  return createHmac("sha256", secret).update(parts.join("|")).digest("hex");
}

/**
 * Consomme un essai. Retourne false si la limite est atteinte.
 * `discriminant` permet de limiter aussi par cible (ex. e-mail visé).
 */
export async function consumeRateLimit(action: RateAction, discriminant?: string): Promise<boolean> {
  const rule = RATE_RULES[action];
  const admin = createAdminSupabaseClient();
  if (!admin) {
    logger.warn("Limitation de débit inactive : clé secrète absente", { module: "anti-abus", action });
    return true;
  }
  const ip = await clientIp();
  const keys = [fingerprint([action, "ip", ip])];
  if (discriminant) keys.push(fingerprint([action, "cible", discriminant.toLowerCase()]));

  for (const key of keys) {
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key_hash: key,
      p_limit: rule.limit * getServerEnv().RATE_LIMIT_SCALE,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) {
      // Panne de la base : on laisse passer (pas de blocage des visiteurs), mais on le signale.
      logger.error("Limitation de débit indisponible", { module: "anti-abus", action, error });
      return true;
    }
    if (data === false) {
      logger.warn("Limite atteinte", { module: "anti-abus", action });
      return false;
    }
  }
  return true;
}
