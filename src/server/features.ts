import "server-only";
import { FEATURE_KEYS, FEATURES, featureEnvName, type FeatureKey, type FeatureRequirement } from "@/config/feature-flags";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerEnv, type ServerEnv } from "@/lib/env.server";

export interface FeatureState {
  key: FeatureKey;
  requested: boolean;
  /** Dépendances manquantes ; vide = disponible. */
  missing: FeatureRequirement[];
  enabled: boolean;
}

export type FeatureMap = Record<FeatureKey, boolean>;

const REQUIREMENT_LABELS: Record<FeatureRequirement, string> = {
  database: "base Supabase",
  ai: "fournisseur IA et clé",
  payments: "prestataire de paiement et clés",
  email: "fournisseur d’e-mail",
  sms: "fournisseur SMS",
  push: "fournisseur de notifications push",
};

export function requirementLabel(requirement: FeatureRequirement): string {
  return REQUIREMENT_LABELS[requirement];
}

/** Disponibilité réelle des dépendances externes, d'après la configuration. */
export function availableRequirements(env: ServerEnv, databaseConfigured: boolean): Record<FeatureRequirement, boolean> {
  return {
    database: databaseConfigured,
    ai: env.AI_PROVIDER !== "none" && Boolean(env.AI_API_KEY),
    payments: env.PAYMENT_PROVIDER !== "none" && Boolean(env.PAYMENT_API_KEY) && Boolean(env.PAYMENT_WEBHOOK_SECRET),
    // En développement, les e-mails sont simulés dans la console : le flux reste testable.
    email:
      (env.EMAIL_PROVIDER !== "none" && Boolean(env.EMAIL_API_KEY) && Boolean(env.EMAIL_FROM)) ||
      process.env.NODE_ENV !== "production",
    sms: env.SMS_PROVIDER !== "none" && Boolean(env.SMS_API_KEY),
    push: false,
  };
}

export function evaluateFeatures(env: ServerEnv, databaseConfigured: boolean): Record<FeatureKey, FeatureState> {
  const available = availableRequirements(env, databaseConfigured);
  const states = {} as Record<FeatureKey, FeatureState>;
  for (const key of FEATURE_KEYS) {
    const definition = FEATURES[key];
    const override = env[featureEnvName(key) as keyof ServerEnv];
    const requested = override === undefined ? definition.defaultOn : override === "on";
    const missing = definition.requires.filter((requirement) => !available[requirement]);
    states[key] = { key, requested, missing, enabled: requested && missing.length === 0 };
  }
  return states;
}

/** États détaillés (page de statut interne). */
export function getFeatureStates(): Record<FeatureKey, FeatureState> {
  return evaluateFeatures(getServerEnv(), isSupabaseConfigured());
}

/** Vue simplifiée à transmettre aux composants : clé → activée. */
export function getFeatures(): FeatureMap {
  const states = getFeatureStates();
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, states[key].enabled])) as FeatureMap;
}

export function isFeatureEnabled(key: FeatureKey): boolean {
  return getFeatureStates()[key].enabled;
}
