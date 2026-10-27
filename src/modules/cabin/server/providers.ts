import "server-only";
import type { CabinService, CabinStatus } from "../domain/cabin";

/**
 * Intégrations des prestataires (agrégateur de paiement, distributeur de crédit,
 * partenaire CIE…). Chaque intégration utilise l'API officielle d'un prestataire
 * agréé sous contrat ; ses clés restent dans l'environnement du serveur.
 *
 * Aucune intégration n'est enregistrée : aucun contrat ni clé n'est disponible.
 * Tant que ce registre est vide, toutes les opérations restent en démonstration,
 * même si l'administration passe un prestataire en mode « réel ».
 *
 * Règles pour ajouter une intégration :
 * - le paiement est autorisé dans le parcours sécurisé du fournisseur (redirection,
 *   USSD push…) : la plateforme ne demande ni ne reçoit jamais de code PIN ;
 * - `verifyNotification` vérifie la signature de chaque notification avant de
 *   changer un état (rejouée : sans effet, garanti par `set_cabin_status`) ;
 * - un résultat incertain renvoie `awaiting_confirmation`, jamais une relance.
 */

export interface InitiateInput {
  reference: string;
  service: CabinService;
  network: string;
  targetNetwork: string | null;
  /** Numéro ou compteur en clair : transmis au prestataire seulement, jamais conservé ni journalisé. */
  recipient: string;
  sender: string | null;
  amountXof: number;
  totalXof: number;
}

export interface InitiateResult {
  status: Extract<CabinStatus, "pending" | "processing" | "awaiting_confirmation" | "failed">;
  /** Page d'autorisation du fournisseur, si le parcours en comporte une. */
  redirectUrl?: string;
  providerReference?: string;
}

export interface ProviderNotification {
  reference: string;
  status: CabinStatus;
  providerReference?: string;
  /** Code ou jeton de recharge (CIE) renvoyé par le prestataire. */
  deliveryCode?: string;
  detail: string;
}

export interface CabinProviderAdapter {
  code: string;
  /** Variables d'environnement indispensables (clés, identifiants marchand). */
  requiredEnv: readonly string[];
  services: readonly CabinService[];
  initiate(input: InitiateInput): Promise<InitiateResult>;
  /** Notification authentifiée (signature vérifiée) ou null si invalide. */
  verifyNotification(request: Request): Promise<ProviderNotification | null>;
}

const ADAPTERS: Record<string, CabinProviderAdapter> = {};

/** Intégration utilisable : enregistrée dans le code ET configurée (toutes ses clés présentes). */
export function liveAdapter(code: string | null | undefined): CabinProviderAdapter | null {
  const adapter = code ? ADAPTERS[code] : undefined;
  if (!adapter) return null;
  return adapter.requiredEnv.every((name) => Boolean(process.env[name]?.trim())) ? adapter : null;
}

export function registeredAdapterCodes(): string[] {
  return Object.keys(ADAPTERS);
}
