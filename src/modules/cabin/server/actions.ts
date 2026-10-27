"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { SITE } from "@/config/site";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";
import { consumeRateLimit, fingerprint } from "@/server/rate-limit";
import {
  CABIN_SERVICES,
  CABIN_STATUSES,
  maskMeter,
  maskPhone,
  normalizeCiPhone,
  normalizeMeter,
  SERVICE_SHAPES,
  totals,
  type CabinStatus,
} from "../domain/cabin";
import { liveAdapter } from "./providers";
import { loadCabinCatalog } from "./queries";
import { QUOTE_VALIDITY_MS, signQuote, verifyQuote, type QuotePayload } from "./quote";

/*
 * Cabine en ligne : devis (récapitulatif signé), confirmation idempotente,
 * suivi. Jamais de code PIN ni de mot de passe : l'autorisation du paiement se
 * fait dans le parcours sécurisé du fournisseur. Aucun numéro en clair n'est
 * conservé ni journalisé (empreintes et numéros masqués seulement).
 */

const log = logger.child({ module: "cabine" });
const FOLLOW_COOKIE = "cdp_cabine";

export type QuoteState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: string }
  | { status: "success"; token: string; quote: QuotePayload; recipientMasked: string; modeReason: string; routeNote: string | null };

export type OperationView = {
  reference: string;
  status: CabinStatus;
  statusReason: string | null;
  mode: "demo" | "live";
  recipientMasked: string;
  amount: number;
  serviceFee: number;
  providerFee: number;
  total: number;
  deliveryCode: string | null;
  updatedAt: string;
};

export type ConfirmState = { status: "idle" } | { status: "error"; message: string; requote?: boolean } | { status: "success"; operation: OperationView; redirectUrl?: string };

const quoteInput = z.object({
  service: z.enum(CABIN_SERVICES),
  network: z.string().min(2).max(40),
  targetNetwork: z.string().min(2).max(40).nullable(),
  offerId: z.uuid().nullable(),
  recipient: z.string().max(40),
  sender: z.string().max(40).nullable(),
  amount: z.number().int().positive().max(100_000_000).nullable(),
});
export type QuoteInput = z.infer<typeof quoteInput>;

const UNAVAILABLE = "La cabine est momentanément indisponible. Réessayez plus tard.";

function recipientFingerprint(value: string) {
  return fingerprint(["cabine", "destinataire", value]);
}

/** Étape 5 : récapitulatif calculé par le serveur (frais compris), signé, valable 10 minutes. */
export async function quoteCabinAction(raw: QuoteInput): Promise<QuoteState> {
  if (!isFeatureEnabled("cabin")) return { status: "error", message: UNAVAILABLE };
  const parsed = quoteInput.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Informations incomplètes : reprenez les étapes précédentes." };
  const input = parsed.data;
  if (!(await consumeRateLimit("cabinQuote"))) return { status: "error", message: "Trop de demandes. Patientez quelques minutes." };

  const catalog = await loadCabinCatalog().catch((error: unknown) => {
    log.error("Configuration de la cabine illisible", { error });
    return null;
  });
  if (!catalog) return { status: "error", message: UNAVAILABLE };
  const settings = catalog.services.find((item) => item.service === input.service);
  if (!settings?.is_enabled) return { status: "error", message: "Ce service est momentanément suspendu." };
  const shape = SERVICE_SHAPES[input.service];
  const network = catalog.networks.find((item) => item.code === input.network && item.is_active && item.kind === shape.networkKind);
  if (!network) return { status: "error", message: "Réseau indisponible pour ce service.", field: "network" };

  let routeNote: string | null = null;
  if (input.service === "money_transfer") {
    const route = catalog.routes.find((item) => item.source_code === input.network && item.target_code === input.targetNetwork);
    if (!route) return { status: "error", message: "Choisissez deux réseaux différents.", field: "target" };
    if (!route.live) routeNote = route.note ?? "Aucun prestataire connecté ne prend en charge cette combinaison.";
  }

  // Destinataire (et expéditeur) : vérifiés, masqués, réduits à une empreinte.
  const recipient = shape.recipient === "meter" ? normalizeMeter(input.recipient) : normalizeCiPhone(input.recipient);
  if (!recipient) {
    return {
      status: "error",
      field: "recipient",
      message: shape.recipient === "meter" ? "Numéro de compteur invalide (chiffres uniquement)." : "Numéro invalide : 10 chiffres commençant par 01, 05 ou 07.",
    };
  }
  let senderFingerprint: string | null = null;
  if (shape.sender) {
    const sender = input.sender ? normalizeCiPhone(input.sender) : null;
    if (!sender) return { status: "error", field: "sender", message: "Numéro de l’expéditeur invalide : 10 chiffres commençant par 01, 05 ou 07." };
    senderFingerprint = recipientFingerprint(sender);
  }

  let amount = input.amount;
  if (shape.usesOffers) {
    const offer = catalog.offers.find((item) => item.id === input.offerId && item.network_code === input.network);
    if (!offer) return { status: "error", field: "amount", message: "Cette offre n’est plus proposée." };
    amount = offer.price_xof;
  }
  if (!amount || amount < settings.min_amount_xof || amount > settings.max_amount_xof) {
    return { status: "error", field: "amount", message: `Montant entre ${settings.min_amount_xof} et ${settings.max_amount_xof} F CFA.` };
  }

  const mode = settings.mode === "live" && (input.service !== "money_transfer" || !routeNote) ? "live" : "demo";
  // Frais du fournisseur : inconnus sans intégration ; une intégration les fournira ici, avant confirmation.
  const computed = totals(amount, settings.fee_bps, 0);
  const recipientMasked = shape.recipient === "meter" ? maskMeter(recipient) : maskPhone(recipient);
  const quote: QuotePayload = {
    service: input.service,
    network: input.network,
    targetNetwork: input.service === "money_transfer" ? input.targetNetwork : null,
    offerId: shape.usesOffers ? input.offerId : null,
    recipientMasked,
    recipientFingerprint: recipientFingerprint(recipient),
    senderFingerprint,
    amount: computed.amount,
    feeBps: settings.fee_bps,
    serviceFee: computed.serviceFee,
    providerFee: computed.providerFee,
    total: computed.total,
    mode,
    expiresAt: new Date(Date.now() + QUOTE_VALIDITY_MS).toISOString(),
  };
  const token = signQuote(quote);
  if (!token) return { status: "error", message: UNAVAILABLE };
  return { status: "success", token, quote, recipientMasked, modeReason: settings.modeReason, routeNote };
}

const confirmInput = z.object({
  token: z.string().min(10).max(4000),
  idempotencyKey: z.uuid(),
  recipient: z.string().max(40),
  sender: z.string().max(40).nullable(),
});

const HINT_MESSAGES: Record<string, string> = {
  MONTANT_CHANGE: "Le montant ou les frais ont changé : vérifiez le nouveau récapitulatif avant de confirmer.",
  DEVIS_EXPIRE: "Le récapitulatif a expiré : vérifiez-le de nouveau avant de confirmer.",
  SERVICE_FERME: "Ce service vient d’être suspendu.",
  RESEAU_FERME: "Ce réseau vient d’être suspendu.",
  OFFRE_INDISPONIBLE: "Cette offre n’est plus proposée.",
  MONTANT_HORS_LIMITES: "Le montant est hors des limites du service.",
};

async function rememberOperation(reference: string, followToken: string) {
  const store = await cookies();
  let entries: Record<string, string> = {};
  try {
    entries = JSON.parse(store.get(FOLLOW_COOKIE)?.value ?? "{}") as Record<string, string>;
  } catch {
    entries = {};
  }
  entries[reference] = followToken;
  const recent = Object.fromEntries(Object.entries(entries).slice(-10));
  store.set(FOLLOW_COOKIE, JSON.stringify(recent), {
    httpOnly: true,
    sameSite: "lax",
    secure: SITE.url.startsWith("https://"),
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Étape 6 : confirmation. Une même clé d'idempotence renvoie toujours la même
 * opération (double clic, réseau qui relance l'envoi). Démonstration : rien
 * n'est débité, l'opération est enregistrée comme annulée, jamais réussie.
 */
export async function confirmCabinAction(raw: z.infer<typeof confirmInput>): Promise<ConfirmState> {
  if (!isFeatureEnabled("cabin")) return { status: "error", message: UNAVAILABLE };
  const parsed = confirmInput.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Confirmation invalide : reprenez le récapitulatif.", requote: true };
  const verified = verifyQuote(parsed.data.token);
  if (!verified.ok) {
    return {
      status: "error",
      requote: true,
      message: verified.reason === "expire" ? HINT_MESSAGES.DEVIS_EXPIRE! : "Récapitulatif invalide : vérifiez-le de nouveau.",
    };
  }
  const quote = verified.payload;
  const shape = SERVICE_SHAPES[quote.service];
  const recipient = shape.recipient === "meter" ? normalizeMeter(parsed.data.recipient) : normalizeCiPhone(parsed.data.recipient);
  const sender = shape.sender && parsed.data.sender ? normalizeCiPhone(parsed.data.sender) : null;
  // Le destinataire confirmé doit être celui du récapitulatif.
  if (!recipient || recipientFingerprint(recipient) !== quote.recipientFingerprint || (shape.sender && (!sender || recipientFingerprint(sender) !== quote.senderFingerprint))) {
    return { status: "error", requote: true, message: "Les informations saisies ont changé : vérifiez le nouveau récapitulatif." };
  }
  if (!(await consumeRateLimit("cabinOperation", quote.recipientFingerprint))) {
    return { status: "error", message: "Trop d’opérations en peu de temps. Patientez avant de recommencer." };
  }
  const admin = createAdminSupabaseClient();
  if (!admin) return { status: "error", message: UNAVAILABLE };

  const user = await getSessionUser().catch(() => null);
  const followToken = randomBytes(32).toString("hex");
  const settings = (await loadCabinCatalog().catch(() => null))?.services.find((item) => item.service === quote.service);
  const adapter = settings?.mode === "live" ? liveAdapter(settings.provider_code) : null;

  const { data, error } = await admin.rpc("create_cabin_operation", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_follow_token_hash: hashToken(followToken),
    p_user: (user?.id ?? null) as string,
    p_service: quote.service,
    p_network: quote.network,
    p_target_network: (quote.targetNetwork ?? null) as string,
    p_offer: (quote.offerId ?? null) as string,
    p_recipient_masked: quote.recipientMasked,
    p_recipient_fingerprint: quote.recipientFingerprint,
    p_amount: quote.amount,
    p_expected_total: quote.total,
    p_quote_expires_at: quote.expiresAt,
    p_live_available: Boolean(adapter),
  });
  if (error) {
    const hint = (error as { hint?: string }).hint ?? "";
    if (HINT_MESSAGES[hint]) return { status: "error", message: HINT_MESSAGES[hint]!, requote: ["MONTANT_CHANGE", "DEVIS_EXPIRE"].includes(hint) };
    log.error("Opération de la cabine non créée", { code: error.code });
    return { status: "error", message: "L’opération n’a pas pu être enregistrée. Aucun paiement n’a été lancé." };
  }
  const row = z.object({ id: z.uuid(), reference: z.string(), status: z.enum(CABIN_STATUSES), mode: z.enum(["demo", "live"]), created: z.boolean() }).parse(data?.[0]);
  // Nouvelle opération : le jeton de suivi est celui-ci. Envoi répété : on garde le jeton déjà remis.
  if (row.created) await rememberOperation(row.reference, followToken);

  let redirectUrl: string | undefined;
  if (row.created && row.mode === "live" && adapter) {
    try {
      const started = await adapter.initiate({
        reference: row.reference,
        service: quote.service,
        network: quote.network,
        targetNetwork: quote.targetNetwork,
        recipient,
        sender,
        amountXof: quote.amount,
        totalXof: quote.total,
      });
      redirectUrl = started.redirectUrl;
      if (started.status !== "pending") {
        await admin.rpc("set_cabin_status", {
          p_operation: row.id,
          p_status: started.status,
          p_source: "serveur",
          p_detail: "Réponse du prestataire à l’envoi",
          p_provider_reference: started.providerReference as string,
        });
      }
    } catch (cause) {
      // Résultat inconnu : jamais de relance automatique (risque de double débit).
      log.error("Envoi au prestataire incertain", { reference: row.reference, cause });
      await admin.rpc("set_cabin_status", { p_operation: row.id, p_status: "awaiting_confirmation", p_source: "serveur", p_detail: "Réponse du prestataire non reçue" });
    }
  }
  const operation = await readOperation(row.reference);
  if (!operation) return { status: "error", message: "Opération enregistrée : consultez son état avec la référence " + row.reference + "." };
  return { status: "success", operation, redirectUrl };
}

async function readOperation(reference: string): Promise<OperationView | null> {
  const store = await cookies();
  let entries: Record<string, string> = {};
  try {
    entries = JSON.parse(store.get(FOLLOW_COOKIE)?.value ?? "{}") as Record<string, string>;
  } catch {
    return null;
  }
  const token = entries[reference];
  const admin = createAdminSupabaseClient();
  if (!token || !admin) return null;
  const { data } = await admin.rpc("cabin_operation_status", { p_reference: reference, p_token_hash: hashToken(token) });
  const row = data?.[0];
  if (!row) return null;
  return {
    reference: row.reference,
    status: row.status,
    statusReason: row.status_reason,
    mode: row.mode,
    recipientMasked: row.recipient_masked,
    amount: row.amount_xof,
    serviceFee: row.service_fee_xof,
    providerFee: row.provider_fee_xof,
    total: row.total_xof,
    deliveryCode: row.delivery_code,
    updatedAt: row.updated_at,
  };
}

/** Suivi d'une opération par le navigateur qui l'a confirmée (jeton dans un cookie protégé). */
export async function followCabinAction(reference: string): Promise<OperationView | null> {
  if (!/^CAB-[0-9A-F]{10}$/.test(reference)) return null;
  return readOperation(reference);
}
