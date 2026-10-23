import "server-only";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/server/features";

/**
 * Canaux d'envoi des notifications. E-mail : Resend si configuré ; sans
 * fournisseur, simulé dans la console en développement et ignoré en
 * production (jamais présenté comme envoyé). Push et SMS : abstraction prête,
 * inactive tant qu'aucun fournisseur n'est branché.
 */

export type ChannelOutcome = { status: "sent" | "simulated" | "skipped" | "failed"; error?: string };

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Adresse de désabonnement en un clic (RFC 8058). */
  oneClickUnsubscribeUrl: string;
  /** Même clé pour un même envoi : le fournisseur n'enverra jamais deux fois. */
  idempotencyKey: string;
}

const mask = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

export async function sendEmail(email: OutgoingEmail): Promise<ChannelOutcome> {
  const env = getServerEnv();
  if (!isFeatureEnabled("email_notifications")) return { status: "skipped", error: "email_desactive" };
  if (env.EMAIL_PROVIDER === "none") {
    if (process.env.NODE_ENV === "production") return { status: "skipped", error: "aucun_fournisseur" };
    logger.info("E-mail simulé (aucun fournisseur en développement)", { module: "notifications", to: mask(email.to), subject: email.subject });
    return { status: "simulated" };
  }
  if (env.EMAIL_PROVIDER !== "resend") return { status: "skipped", error: `${env.EMAIL_PROVIDER}_non_pris_en_charge` };
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) return { status: "skipped", error: "configuration_incomplete" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": email.idempotencyKey },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: { "List-Unsubscribe": `<${email.oneClickUnsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return { status: "sent" };
    return { status: "failed", error: `http_${response.status}` };
  } catch (error) {
    return { status: "failed", error: error instanceof Error && error.name === "TimeoutError" ? "delai_depasse" : "reseau" };
  }
}

/** Notifications push : aucun fournisseur branché (drapeau `push_notifications` indisponible). */
export async function sendPush(): Promise<ChannelOutcome> {
  return { status: "skipped", error: "aucun_fournisseur" };
}

/** SMS : aucun fournisseur branché (drapeau `sms` indisponible). */
export async function sendSms(): Promise<ChannelOutcome> {
  return { status: "skipped", error: getServerEnv().SMS_PROVIDER === "none" ? "aucun_fournisseur" : "fournisseur_non_pris_en_charge" };
}
