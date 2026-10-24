/**
 * Défi anti-robot léger, sans service tiers ni suivi : un champ piège
 * invisible (un robot le remplit, un humain ne le voit pas) et un délai
 * minimal entre l'affichage du formulaire et son envoi. Complète la
 * limitation de débit ; aucune donnée n'est conservée.
 */
export const BOT_TRAP_FIELDS = { honeypot: "site_web", openedAt: "ouvert_a" } as const;

/** Délai minimal par défaut (ms) ; abaissé pour les tests automatisés (BOT_TRAP_MIN_MS). */
export const BOT_TRAP_DEFAULT_MS = 2500;
/** Au-delà, la page est considérée comme ancienne : on redemande un envoi (aucun blocage). */
const STALE_MS = 6 * 3600_000;

export type BotTrapVerdict = "ok" | "robot" | "trop_rapide";

export function checkBotTrap(formData: FormData, now: number, minMs = BOT_TRAP_DEFAULT_MS): BotTrapVerdict {
  const honeypot = formData.get(BOT_TRAP_FIELDS.honeypot);
  if (typeof honeypot === "string" && honeypot.trim() !== "") return "robot";
  if (minMs <= 0) return "ok";
  const openedAt = Number(formData.get(BOT_TRAP_FIELDS.openedAt));
  // Champ absent (JavaScript désactivé ou robot) : on demande de réessayer, sans bloquer.
  if (!Number.isFinite(openedAt) || openedAt <= 0) return "trop_rapide";
  const elapsed = now - openedAt;
  if (elapsed < minMs || elapsed > STALE_MS) return "trop_rapide";
  return "ok";
}

export const TOO_FAST_MESSAGE = "Envoi trop rapide : vérifiez vos informations puis renvoyez le formulaire.";
