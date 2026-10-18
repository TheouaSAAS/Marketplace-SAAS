import { logger } from "@/lib/logger";

/**
 * `fetch` avec délai maximal pour les clients Supabase côté serveur.
 * Sans délai, une coupure réseau peut laisser une action serveur (connexion,
 * publication…) en attente indéfiniment ; avec lui, l'appel échoue proprement
 * et l'utilisateur reçoit un message d'erreur.
 * Les appels lents ou interrompus sont journalisés (chemin seulement, sans
 * paramètres ni corps : aucune donnée personnelle).
 */
export const SUPABASE_TIMEOUT_MS = 10_000;
export const SLOW_CALL_MS = 3_000;

function describe(input: RequestInfo | URL): string {
  try {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    return url.pathname;
  } catch {
    return "inconnu";
  }
}

export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = SUPABASE_TIMEOUT_MS): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const started = performance.now();
  try {
    const response = await fetch(input, { ...init, signal });
    const elapsed = Math.round(performance.now() - started);
    if (elapsed >= SLOW_CALL_MS) {
      logger.warn("Appel Supabase lent", { module: "supabase", chemin: describe(input), methode: init?.method ?? "GET", dureeMs: elapsed, statut: response.status });
    }
    return response;
  } catch (error) {
    logger.warn("Appel Supabase interrompu", {
      module: "supabase",
      chemin: describe(input),
      methode: init?.method ?? "GET",
      dureeMs: Math.round(performance.now() - started),
      raison: error instanceof Error ? error.name : "inconnue",
    });
    throw error;
  }
}
