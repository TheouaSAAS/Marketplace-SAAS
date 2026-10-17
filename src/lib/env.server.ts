import "server-only";
import { z } from "zod";
import { blankAsUndefined, formatEnvIssues } from "./env";

/**
 * Variables d'environnement SERVEUR. Le module `server-only` fait échouer la
 * compilation si ce fichier est importé depuis un composant client : un secret
 * ne peut donc pas fuiter dans le bundle navigateur par erreur.
 */

export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: blankAsUndefined(z.string().trim().optional()),
  AI_PROVIDER: blankAsUndefined(z.enum(["none", "anthropic", "openai"]).default("none")),
  AI_API_KEY: blankAsUndefined(z.string().trim().optional()),
  AI_MODEL: blankAsUndefined(z.string().trim().optional()),
  PAYMENT_PROVIDER: blankAsUndefined(
    z.enum(["none", "cinetpay", "paydunya", "wave", "orange_money", "mtn_momo"]).default("none"),
  ),
  PAYMENT_API_KEY: blankAsUndefined(z.string().trim().optional()),
  PAYMENT_SITE_ID: blankAsUndefined(z.string().trim().optional()),
  PAYMENT_WEBHOOK_SECRET: blankAsUndefined(z.string().trim().optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Lecture paresseuse : une variable mal formée n'empêche pas les pages publiques de se charger. */
export function getServerEnv(): ServerEnv {
  if (!cached) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Variables d'environnement serveur invalides :\n${formatEnvIssues(result.error)}`);
    }
    cached = result.data;
  }
  return cached;
}
