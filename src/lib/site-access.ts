/**
 * Accès réservé (bêta privée, préproduction) : quand `SITE_ACCESS_CODE` est
 * défini, le site n'est servi qu'aux navigateurs qui ont saisi ce code.
 *
 * Le cookie contient une empreinte du code, jamais le code lui-même ; changer
 * le code invalide tous les accès donnés. Fonctions Web Crypto : utilisables
 * par le proxy comme par les actions serveur.
 */

export const SITE_ACCESS_COOKIE = "cdp_acces";
export const SITE_ACCESS_MAX_AGE = 60 * 60 * 24 * 30;

/** Chemins toujours servis : la page de saisie, la supervision et les tâches planifiées. */
export const SITE_ACCESS_EXEMPT = ["/acces", "/maintenance", "/interne", "/api/health", "/api/interne", "/api/desabonnement", "/api/cabine/notifications", "/robots.txt"];

export async function siteAccessFingerprint(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`carrefour-des-possibles:acces:${code}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Comparaison à temps constant de deux chaînes de même nature (empreintes). */
export function sameFingerprint(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function hasSiteAccess(cookie: string | undefined, code: string | undefined): Promise<boolean> {
  if (!code) return true;
  if (!cookie) return false;
  return sameFingerprint(cookie, await siteAccessFingerprint(code));
}

export function isSiteAccessExempt(pathname: string): boolean {
  return SITE_ACCESS_EXEMPT.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
