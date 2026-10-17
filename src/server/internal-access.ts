import "server-only";
import { getServerEnv } from "@/lib/env.server";
import { internalTokenMatches } from "@/lib/internal-token";

/**
 * Accès à la page de statut interne (seconde ligne de défense : le proxy
 * bloque déjà la requête avant le rendu). Au niveau 3, l'accès sera aussi
 * ouvert aux administrateurs connectés.
 */
export function canViewInternalStatus(providedToken: string | undefined, expectedToken = getServerEnv().INTERNAL_STATUS_TOKEN): boolean {
  return internalTokenMatches(providedToken, expectedToken);
}
