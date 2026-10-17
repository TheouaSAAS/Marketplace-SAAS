// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, featureEnvName } from "@/config/feature-flags";
import { parseServerEnv, serverEnvSchema } from "@/lib/env.server";
import { evaluateFeatures } from "./features";

describe("évaluation des drapeaux", () => {
  it("chaque drapeau possède sa variable de forçage dans le schéma d'environnement", () => {
    for (const key of FEATURE_KEYS) expect(Object.keys(serverEnvSchema.shape)).toContain(featureEnvName(key));
  });

  it("sans aucun service externe, le site garde les fonctions sans dépendance", () => {
    const states = evaluateFeatures(parseServerEnv({}), false);
    expect(states.map.enabled).toBe(true);
    expect(states.geolocation.enabled).toBe(true);
    expect(states.maintenance.enabled).toBe(false);
  });

  it("n'active jamais une fonction dont le service n'est pas configuré, même forcée", () => {
    const states = evaluateFeatures(parseServerEnv({ FEATURE_AI_ASSISTANT: "on", FEATURE_PAYMENTS: "on" }), false);
    expect(states.ai_assistant.requested).toBe(true);
    expect(states.ai_assistant.enabled).toBe(false);
    expect(states.ai_assistant.missing).toEqual(["ai", "database"]);
    expect(states.payments.enabled).toBe(false);
    expect(states.accounts.enabled).toBe(false);
  });

  it("active l'IA seulement avec un fournisseur ET une clé", () => {
    expect(evaluateFeatures(parseServerEnv({ AI_PROVIDER: "anthropic" }), true).ai_search.enabled).toBe(false);
    expect(evaluateFeatures(parseServerEnv({ AI_PROVIDER: "anthropic", AI_API_KEY: "k" }), true).ai_search.enabled).toBe(true);
  });

  it("exige la clé ET le secret de webhook pour les paiements", () => {
    const base = { PAYMENT_PROVIDER: "cinetpay", PAYMENT_API_KEY: "k", FEATURE_PAYMENTS: "on" };
    expect(evaluateFeatures(parseServerEnv(base), true).payments.enabled).toBe(false);
    expect(evaluateFeatures(parseServerEnv({ ...base, PAYMENT_WEBHOOK_SECRET: "s" }), true).payments.enabled).toBe(true);
  });

  it("permet de couper une fonction disponible", () => {
    const states = evaluateFeatures(parseServerEnv({ FEATURE_MAP: "off" }), true);
    expect(states.map.requested).toBe(false);
    expect(states.map.enabled).toBe(false);
  });

  it("refuse une valeur de forçage inconnue", () => {
    expect(() => parseServerEnv({ FEATURE_MAP: "oui" })).toThrow(/FEATURE_MAP/);
  });
});
