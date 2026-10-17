/**
 * Catalogue des fonctionnalités activables (drapeaux).
 *
 * Une fonctionnalité est ACTIVE si elle est demandée (valeur par défaut ou
 * variable FEATURE_<CLÉ>=on|off) ET disponible (service externe réellement
 * configuré). Une fonctionnalité demandée mais indisponible reste désactivée :
 * on ne présente jamais comme opérationnel un service sans clés.
 *
 * Évaluation : `src/server/features.ts` (serveur). Les composants clients
 * reçoivent les valeurs déjà évaluées en props, jamais les variables.
 */

export const FEATURE_KEYS = [
  "accounts",
  "publishing",
  "pro_publishing",
  "messaging",
  "reviews",
  "map",
  "geolocation",
  "ai_search",
  "ai_assistant",
  "ai_publishing",
  "ai_moderation",
  "payments",
  "email_notifications",
  "push_notifications",
  "sms",
  "maintenance",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Dépendance externe nécessaire au fonctionnement réel. */
export type FeatureRequirement = "database" | "ai" | "payments" | "email" | "sms" | "push";

export interface FeatureDefinition {
  label: string;
  description: string;
  /** Valeur demandée en l'absence de variable FEATURE_<CLÉ>. */
  defaultOn: boolean;
  requires: FeatureRequirement[];
}

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  accounts: {
    label: "Comptes utilisateurs",
    description: "Inscription, connexion, favoris, tableaux de bord.",
    defaultOn: true,
    requires: ["database"],
  },
  publishing: {
    label: "Publication d’annonces",
    description: "Dépôt d’annonces par les membres, soumis à modération.",
    defaultOn: true,
    requires: ["database"],
  },
  pro_publishing: {
    label: "Publication professionnelle",
    description: "Vitrines, organisations et publications multiples des professionnels.",
    defaultOn: true,
    requires: ["database"],
  },
  messaging: {
    label: "Messagerie interne",
    description: "Conversations entre visiteurs et annonceurs.",
    defaultOn: true,
    requires: ["database"],
  },
  reviews: {
    label: "Avis",
    description: "Avis modérés sur les professionnels et lieux.",
    defaultOn: false,
    requires: ["database"],
  },
  map: {
    label: "Carte interactive",
    description: "Carte des contenus géolocalisés (tuiles configurables, OpenStreetMap par défaut).",
    defaultOn: true,
    requires: [],
  },
  geolocation: {
    label: "Autour de moi",
    description: "Position du visiteur, sur autorisation explicite, jamais stockée par défaut.",
    defaultOn: true,
    requires: [],
  },
  ai_search: {
    label: "Recherche en langage naturel (IA)",
    description: "Conversion d’une phrase en filtres structurés. La recherche classique reste disponible.",
    defaultOn: true,
    requires: ["ai"],
  },
  ai_assistant: {
    label: "Assistant « Demandez à San Pedro »",
    description: "Réponses fondées uniquement sur les contenus validés, avec sources.",
    defaultOn: true,
    requires: ["ai", "database"],
  },
  ai_publishing: {
    label: "Copilote de publication (IA)",
    description: "Suggestions modifiables lors du dépôt d’une annonce ; jamais de publication automatique.",
    defaultOn: true,
    requires: ["ai"],
  },
  ai_moderation: {
    label: "Aide à la modération (IA)",
    description: "Suggestions pour l’équipe ; aucune décision automatique.",
    defaultOn: false,
    requires: ["ai", "database"],
  },
  payments: {
    label: "Paiements",
    description: "Abonnements et mises en avant (Mobile Money, carte). Aucun paiement simulé.",
    defaultOn: false,
    requires: ["payments", "database"],
  },
  email_notifications: {
    label: "E-mails transactionnels",
    description: "Messages, modération, expiration. Simulés dans la console en développement.",
    defaultOn: true,
    requires: ["email"],
  },
  push_notifications: {
    label: "Notifications push",
    description: "Non disponible tant qu’aucun fournisseur n’est configuré.",
    defaultOn: false,
    requires: ["push"],
  },
  sms: {
    label: "SMS",
    description: "Non disponible tant qu’aucun fournisseur n’est configuré.",
    defaultOn: false,
    requires: ["sms"],
  },
  maintenance: {
    label: "Mode maintenance",
    description: "Affiche la page de maintenance au public.",
    defaultOn: false,
    requires: [],
  },
};

/** Variable d'environnement qui force un drapeau : ai_search → FEATURE_AI_SEARCH. */
export function featureEnvName(key: FeatureKey): `FEATURE_${string}` {
  return `FEATURE_${key.toUpperCase()}`;
}
