// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { signQuote, verifyQuote } = await import("./quote");

const payload = {
  service: "airtime" as const,
  network: "orange",
  targetNetwork: null,
  offerId: null,
  recipientMasked: "07 ** ** ** 11",
  recipientFingerprint: "a".repeat(64),
  senderFingerprint: null,
  amount: 10_000,
  feeBps: 50,
  serviceFee: 50,
  providerFee: 0,
  total: 10_050,
  mode: "demo" as const,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe("récapitulatif signé de la cabine", () => {
  beforeEach(() => vi.stubEnv("SUPABASE_SECRET_KEY", "cle-de-test-du-serveur"));
  afterEach(() => vi.unstubAllEnvs());

  it("vérifie un récapitulatif intact", () => {
    const token = signQuote(payload)!;
    const verified = verifyQuote(token);
    expect(verified.ok && verified.payload.total).toBe(10_050);
  });

  it("refuse un total modifié dans le navigateur", () => {
    const [, signature] = signQuote(payload)!.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, total: 10_000, serviceFee: 0 })).toString("base64url");
    expect(verifyQuote(`${forged}.${signature}`)).toEqual({ ok: false, reason: "invalide" });
  });

  it("refuse un récapitulatif expiré", () => {
    const token = signQuote({ ...payload, expiresAt: new Date(Date.now() - 1_000).toISOString() })!;
    expect(verifyQuote(token)).toEqual({ ok: false, reason: "expire" });
  });
});
