import { timingSafeEqual } from "node:crypto";

/**
 * Règle d'accès aux pages internes, sans dépendance au runtime des composants
 * serveur : utilisable par le proxy ET par les pages.
 * - Jeton attendu configuré : comparaison à temps constant.
 * - Aucun jeton configuré : accès autorisé hors production uniquement.
 */
export function internalTokenMatches(
  provided: string | null | undefined,
  expected: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (!expected) return nodeEnv !== "production";
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
