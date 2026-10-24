import "server-only";
import { isSupabaseConfigured, publicEnv, publicEnvSchema } from "@/lib/env";
import { getServerEnv, serverEnvSchema } from "@/lib/env.server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export type CheckStatus = "ok" | "not_configured" | "error" | "simulated" | "partial";

export interface ServiceCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

/** Vérifie réellement la connexion à la base (requête minimale sur `cities`). */
export async function checkDatabase(): Promise<ServiceCheck> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    return { name: "Base de données (Supabase)", status: "not_configured", detail: "URL et clé publique absentes de l’environnement." };
  }
  const started = performance.now();
  const { count, error } = await supabase.from("cities").select("id", { count: "exact", head: true });
  const elapsed = Math.round(performance.now() - started);
  if (error) {
    return {
      name: "Base de données (Supabase)",
      status: "error",
      detail: `Connexion établie mais requête en échec (${error.code ?? "?"}) : migrations probablement non appliquées.`,
    };
  }
  return { name: "Base de données (Supabase)", status: "ok", detail: `Joignable en ${elapsed} ms — ${count ?? 0} ville(s) active(s).` };
}

/** État déclaratif des autres services, d'après la configuration (aucun appel externe). */
export function describeServices(): ServiceCheck[] {
  const env = getServerEnv();
  const tileHost = (() => {
    try {
      return new URL(publicEnv.NEXT_PUBLIC_MAP_TILE_URL.replace(/\{[a-z]\}/g, "0")).hostname;
    } catch {
      return "URL invalide";
    }
  })();

  return [
    {
      name: "Stockage des médias",
      status: isSupabaseConfigured() ? "partial" : "not_configured",
      detail: isSupabaseConfigured()
        ? "Bucket « media » créé par migration ; à vérifier après application des migrations."
        : "Dépend de Supabase.",
    },
    { name: "Fond de carte", status: "ok", detail: `Tuiles : ${tileHost}. Aucune clé requise pour OpenStreetMap.` },
    {
      name: "Intelligence artificielle",
      status: env.AI_PROVIDER !== "none" && env.AI_API_KEY ? "partial" : "not_configured",
      detail:
        env.AI_PROVIDER !== "none" && env.AI_API_KEY
          ? `Fournisseur ${env.AI_PROVIDER}${env.AI_MODEL ? `, modèle ${env.AI_MODEL}` : ""} configuré ; intégration livrée au niveau 23.`
          : "Aucun fournisseur : toutes les fonctions IA sont désactivées, le site reste utilisable.",
    },
    {
      name: "Paiements",
      status: env.PAYMENT_PROVIDER !== "none" && env.PAYMENT_API_KEY ? "partial" : "not_configured",
      detail:
        env.PAYMENT_PROVIDER !== "none"
          ? `Prestataire ${env.PAYMENT_PROVIDER} déclaré ; aucun paiement n’est traité tant que l’intégration n’est pas testée.`
          : "Aucun prestataire : aucune transaction possible (jamais simulée).",
    },
    {
      name: "E-mails",
      status: env.EMAIL_PROVIDER !== "none" && env.EMAIL_API_KEY ? "partial" : process.env.NODE_ENV !== "production" ? "simulated" : "not_configured",
      detail:
        env.EMAIL_PROVIDER !== "none"
          ? `Fournisseur ${env.EMAIL_PROVIDER}, expéditeur ${env.EMAIL_FROM ? "renseigné" : "absent"}.`
          : "Aucun fournisseur : en développement, les e-mails sont affichés dans la console.",
    },
    {
      name: "SMS et push",
      status: "not_configured",
      detail: env.SMS_PROVIDER !== "none" ? `SMS : ${env.SMS_PROVIDER} déclaré, non intégré.` : "Aucun fournisseur.",
    },
    {
      name: "Limitation anti-abus",
      status: env.RATE_LIMIT_SCALE === 1 ? (isSupabaseConfigured() && env.SUPABASE_SECRET_KEY ? "ok" : "not_configured") : "error",
      detail:
        env.RATE_LIMIT_SCALE === 1
          ? "Compteurs en base, empreintes HMAC, purge horaire."
          : `Limites multipliées par ${env.RATE_LIMIT_SCALE} (RATE_LIMIT_SCALE) : réglage de test, à retirer.`,
    },
    {
      name: "Défi anti-robot",
      status: env.BOT_TRAP_MIN_MS >= 1000 ? "ok" : "error",
      detail:
        env.BOT_TRAP_MIN_MS >= 1000
          ? `Champ piège et délai minimal de ${env.BOT_TRAP_MIN_MS} ms (inscription, mot de passe oublié).`
          : `Délai minimal de ${env.BOT_TRAP_MIN_MS} ms (BOT_TRAP_MIN_MS) : réglage de test, à retirer.`,
    },
    {
      name: "Suivi des erreurs",
      status: env.ERROR_TRACKING_DSN ? "partial" : "not_configured",
      detail: env.ERROR_TRACKING_DSN
        ? "DSN renseigné ; le SDK n’est pas encore branché (journal structuré seulement)."
        : "Journal structuré JSON dans la sortie du serveur ; aucun service externe.",
    },
  ];
}

/** Liste des variables avec leur seule présence — jamais leur valeur. */
export function environmentPresence(): { name: string; scope: "public" | "serveur"; present: boolean }[] {
  const publicNames = Object.keys(publicEnvSchema.shape);
  const serverNames = Object.keys(serverEnvSchema.shape);
  return [
    ...publicNames.map((name) => ({ name, scope: "public" as const, present: Boolean(process.env[name]?.trim()) })),
    ...serverNames.map((name) => ({ name, scope: "serveur" as const, present: Boolean(process.env[name]?.trim()) })),
  ];
}
