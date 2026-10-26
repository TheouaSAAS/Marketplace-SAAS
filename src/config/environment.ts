/**
 * Environnement de déploiement : développement, préproduction ou production.
 *
 * `APP_ENV` le fixe explicitement ; à défaut, l'hébergeur (Vercel : `VERCEL_ENV`)
 * ou le mode de compilation. Un build de production auto-hébergé est donc
 * « production » par défaut : une préproduction doit déclarer `APP_ENV=preview`.
 *
 * Seule la production est indexable par les moteurs de recherche.
 * Module pur (aucune dépendance) : utilisé par la configuration Next, le proxy et les pages.
 */

export const APP_ENVIRONMENTS = {
  development: "Développement",
  preview: "Préproduction",
  production: "Production",
} as const;

export type AppEnvironment = keyof typeof APP_ENVIRONMENTS;

const isEnvironment = (value: string | undefined): value is AppEnvironment => value !== undefined && Object.hasOwn(APP_ENVIRONMENTS, value);

export function resolveAppEnvironment(source: Record<string, string | undefined> = process.env): AppEnvironment {
  const explicit = source.APP_ENV?.trim();
  if (isEnvironment(explicit)) return explicit;
  const host = source.VERCEL_ENV?.trim();
  if (isEnvironment(host)) return host;
  return source.NODE_ENV === "production" ? "production" : "development";
}

/** Une préproduction ou un poste de développement ne doivent jamais être indexés. */
export function isIndexableEnvironment(environment: AppEnvironment): boolean {
  return environment === "production";
}
