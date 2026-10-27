import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env.server";
import type { CabinService } from "../domain/cabin";

/**
 * Récapitulatif signé par le serveur : ce que le visiteur confirme est
 * exactement ce que le serveur a calculé (montant, frais, total, destinataire
 * sous forme d'empreinte). Toute modification invalide la signature ; la base
 * recalcule encore les frais à la création de l'opération.
 */

export interface QuotePayload {
  service: CabinService;
  network: string;
  targetNetwork: string | null;
  offerId: string | null;
  recipientMasked: string;
  recipientFingerprint: string;
  senderFingerprint: string | null;
  amount: number;
  feeBps: number;
  serviceFee: number;
  providerFee: number;
  total: number;
  mode: "demo" | "live";
  expiresAt: string;
}

export const QUOTE_VALIDITY_MS = 10 * 60 * 1000;

function key(): string | null {
  return getServerEnv().SUPABASE_SECRET_KEY ?? null;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", `cabine-devis:${secret}`).update(body).digest("base64url");
}

export function signQuote(payload: QuotePayload): string | null {
  const secret = key();
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Récapitulatif intact et non expiré, ou la raison du refus. */
export function verifyQuote(token: string, now = Date.now()): { ok: true; payload: QuotePayload } | { ok: false; reason: "invalide" | "expire" } {
  const secret = key();
  const [body, signature] = token.split(".");
  if (!secret || !body || !signature) return { ok: false, reason: "invalide" };
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalide" };
  let payload: QuotePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as QuotePayload;
  } catch {
    return { ok: false, reason: "invalide" };
  }
  if (Date.parse(payload.expiresAt) <= now) return { ok: false, reason: "expire" };
  return { ok: true, payload };
}
