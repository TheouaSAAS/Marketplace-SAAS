/**
 * Contrôle de la configuration avant un déploiement (`npm run env:check`).
 *
 * Ne lit que la PRÉSENCE et la forme des variables, jamais leur valeur dans
 * les messages. Module pur, sans alias d'import : exécuté aussi par Node
 * directement (scripts/env-check.mjs).
 */

export type DeploymentTarget = "development" | "preview" | "production";

export interface ConfigIssue {
  level: "error" | "warning";
  variable: string;
  message: string;
}

type Env = Record<string, string | undefined>;

const filled = (env: Env, name: string) => Boolean(env[name]?.trim());

function httpsUrl(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && url.hostname !== "localhost" && !url.hostname.startsWith("127.");
  } catch {
    return false;
  }
}

export function checkDeploymentConfig(env: Env, target: DeploymentTarget): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const error = (variable: string, message: string) => issues.push({ level: "error", variable, message });
  const warning = (variable: string, message: string) => issues.push({ level: "warning", variable, message });
  const deployed = target !== "development";

  if (!filled(env, "NEXT_PUBLIC_SUPABASE_URL") || !filled(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) {
    (deployed ? error : warning)("NEXT_PUBLIC_SUPABASE_URL", "Base Supabase non configurée : le site s’affiche en mode dégradé.");
  }
  if (!deployed) return issues;

  if (!httpsUrl(env.NEXT_PUBLIC_SITE_URL)) error("NEXT_PUBLIC_SITE_URL", "Adresse publique HTTPS attendue (géolocalisation, HSTS, liens des e-mails).");
  if (!filled(env, "SUPABASE_SECRET_KEY")) error("SUPABASE_SECRET_KEY", "Clé secrète absente : limites anti-abus, notifications et tâches d’administration inactives.");
  if (!filled(env, "INTERNAL_STATUS_TOKEN")) warning("INTERNAL_STATUS_TOKEN", "Sans jeton, la page /interne/statut est inaccessible en production.");
  if (!filled(env, "CRON_SECRET")) warning("CRON_SECRET", "Sans secret, l’envoi planifié des notifications et des alertes de recherche refuse de s’exécuter.");

  for (const name of ["RATE_LIMIT_SCALE", "BOT_TRAP_MIN_MS"]) {
    if (filled(env, name)) error(name, "Réglage réservé aux tests automatisés : à retirer de l’hébergeur.");
  }
  for (const name of ["SUPABASE_ACCESS_TOKEN", "DATABASE_URL"]) {
    if (filled(env, name)) warning(name, "Accès d’administration de la base : à garder hors de l’application (CI ou poste d’exploitation seulement).");
  }

  if ((env.EMAIL_PROVIDER ?? "none") === "none") warning("EMAIL_PROVIDER", "Aucun fournisseur d’e-mails : notifications ignorées, e-mails d’inscription limités par Supabase.");
  else if (!filled(env, "EMAIL_API_KEY") || !filled(env, "EMAIL_FROM")) error("EMAIL_API_KEY", "Fournisseur d’e-mails déclaré sans clé ou sans expéditeur.");

  if ((env.AI_PROVIDER ?? "none") !== "none") {
    if (!filled(env, "AI_API_KEY")) error("AI_API_KEY", "Fournisseur d’IA déclaré sans clé.");
    if (!filled(env, "AI_MONTHLY_BUDGET_EUR")) warning("AI_MONTHLY_BUDGET_EUR", "Aucun plafond mensuel d’IA : les coûts ne sont pas bornés.");
  }
  if ((env.PAYMENT_PROVIDER ?? "none") !== "none") error("PAYMENT_PROVIDER", "Les paiements ne sont pas implémentés : laisser « none ».");

  if (target === "preview") {
    if (env.APP_ENV !== "preview" && env.VERCEL_ENV !== "preview") error("APP_ENV", "Une préproduction doit déclarer APP_ENV=preview (jamais indexée, bandeau visible).");
    if (!filled(env, "SITE_ACCESS_CODE")) warning("SITE_ACCESS_CODE", "Préproduction ouverte à tous : définir un code d’accès.");
  }
  if (target === "production") {
    if (env.APP_ENV && env.APP_ENV !== "production") error("APP_ENV", "La production ne doit pas déclarer un autre environnement (pages non indexées).");
    if (env.FEATURE_MAINTENANCE === "on") warning("FEATURE_MAINTENANCE", "Mode maintenance actif : tout le site répond 503.");
    if (filled(env, "SITE_ACCESS_CODE")) warning("SITE_ACCESS_CODE", "Accès réservé actif : normal en bêta privée, à retirer à l’ouverture.");
  }
  return issues;
}
