import "server-only";
import { APP_ENVIRONMENTS, resolveAppEnvironment } from "@/config/environment";
import { logger } from "@/lib/logger";

/**
 * Erreurs serveur : journal structuré (toujours) et alerte vers un canal de
 * l'équipe (ALERT_WEBHOOK_URL, facultatif). Ni contenu de requête, ni cookie,
 * ni paramètre d'adresse : seulement le chemin, la méthode, le type de rendu
 * et l'empreinte (digest) qui permet de retrouver l'erreur dans les journaux.
 */

const ALERT_INTERVAL_MS = 10 * 60 * 1000;
const lastAlert = new Map<string, number>();

export interface ServerErrorContext {
  path: string;
  method: string;
  routeType?: string;
  routePath?: string;
}

/** Une alerte par erreur (empreinte) et par période : une boucle d'erreurs n'inonde pas le canal. */
export function shouldAlert(key: string, now: number, sent: Map<string, number> = lastAlert): boolean {
  const previous = sent.get(key);
  if (previous !== undefined && now - previous < ALERT_INTERVAL_MS) return false;
  sent.set(key, now);
  if (sent.size > 500) sent.delete(sent.keys().next().value!);
  return true;
}

export async function reportServerError(error: unknown, context: ServerErrorContext): Promise<void> {
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
  const message = error instanceof Error ? error.message : String(error);
  // Chemin sans paramètres : une adresse peut contenir des critères personnels.
  const path = context.path.split("?")[0] ?? context.path;
  logger.error("Erreur serveur", { module: "observabilite", path, method: context.method, routeType: context.routeType, route: context.routePath, digest, error });

  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook || !shouldAlert(digest ?? `${context.routePath ?? path}:${message}`, Date.now())) return;
  const environment = APP_ENVIRONMENTS[resolveAppEnvironment()];
  const text = `[${environment}] Erreur serveur sur ${context.method} ${context.routePath ?? path}${digest ? ` (empreinte ${digest})` : ""} : ${message.slice(0, 200)}`;
  try {
    // Champs « text » (Slack, Google Chat) et « content » (Discord) : compatible avec les principaux canaux.
    await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) });
  } catch (cause) {
    logger.warn("Alerte non envoyée", { module: "observabilite", cause });
  }
}
