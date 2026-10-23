import "server-only";
import { z } from "zod";
import { blankAsUndefined, formatEnvIssues } from "./env";

/**
 * Variables d'environnement SERVEUR. Le module `server-only` fait échouer la
 * compilation si ce fichier est importé depuis un composant client : un secret
 * ne peut donc pas fuiter dans le bundle navigateur par erreur.
 */

const optionalSecret = blankAsUndefined(z.string().trim().optional());
/** Interrupteur de fonctionnalité : « on », « off » ou absent (valeur par défaut du drapeau). */
const flagOverride = blankAsUndefined(z.enum(["on", "off"]).optional());

export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: optionalSecret,

  AI_PROVIDER: blankAsUndefined(z.enum(["none", "anthropic", "openai"]).default("none")),
  AI_API_KEY: optionalSecret,
  AI_MODEL: optionalSecret,
  AI_MONTHLY_BUDGET_EUR: blankAsUndefined(z.coerce.number().nonnegative().optional()),

  PAYMENT_PROVIDER: blankAsUndefined(
    z.enum(["none", "cinetpay", "paydunya", "wave", "orange_money", "mtn_momo"]).default("none"),
  ),
  PAYMENT_API_KEY: optionalSecret,
  PAYMENT_SITE_ID: optionalSecret,
  PAYMENT_WEBHOOK_SECRET: optionalSecret,

  EMAIL_PROVIDER: blankAsUndefined(z.enum(["none", "resend", "smtp"]).default("none")),
  EMAIL_API_KEY: optionalSecret,
  EMAIL_FROM: blankAsUndefined(z.email().optional()),

  SMS_PROVIDER: blankAsUndefined(z.enum(["none", "twilio", "orange"]).default("none")),
  SMS_API_KEY: optionalSecret,

  ERROR_TRACKING_DSN: blankAsUndefined(z.url().optional()),
  LOG_LEVEL: blankAsUndefined(z.enum(["debug", "info", "warn", "error"]).default("info")),

  /** Multiplicateur des limites anti-abus. TESTS AUTOMATISÉS UNIQUEMENT ; jamais en production. */
  RATE_LIMIT_SCALE: blankAsUndefined(z.coerce.number().int().min(1).max(1000).default(1)),

  /** Jeton d'accès à /interne/statut. Obligatoire en production pour consulter la page. */
  INTERNAL_STATUS_TOKEN: blankAsUndefined(z.string().min(24, "24 caractères minimum").optional()),

  /** Secret des tâches planifiées (envoi des notifications, alertes) : en-tête « Authorization: Bearer … ». */
  CRON_SECRET: blankAsUndefined(z.string().min(24, "24 caractères minimum").optional()),

  FEATURE_ACCOUNTS: flagOverride,
  FEATURE_PUBLISHING: flagOverride,
  FEATURE_PRO_PUBLISHING: flagOverride,
  FEATURE_MESSAGING: flagOverride,
  FEATURE_REVIEWS: flagOverride,
  FEATURE_MAP: flagOverride,
  FEATURE_GEOLOCATION: flagOverride,
  FEATURE_AI_SEARCH: flagOverride,
  FEATURE_AI_ASSISTANT: flagOverride,
  FEATURE_AI_PUBLISHING: flagOverride,
  FEATURE_AI_MODERATION: flagOverride,
  FEATURE_PAYMENTS: flagOverride,
  FEATURE_EMAIL_NOTIFICATIONS: flagOverride,
  FEATURE_PUSH_NOTIFICATIONS: flagOverride,
  FEATURE_SMS: flagOverride,
  FEATURE_MAINTENANCE: flagOverride,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Valide une source donnée (utilisé par les tests). */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variables d'environnement serveur invalides :\n${formatEnvIssues(result.error)}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Lecture paresseuse : une variable mal formée n'empêche pas les pages publiques de se charger. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
