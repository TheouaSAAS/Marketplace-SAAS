/**
 * Choix proposés dans la rédaction du guide (équipe locale). Valeurs alignées
 * sur les énumérations SQL `content_status`, `verification_status`, `source_kind`.
 */

export const ARTICLE_STATUSES = {
  draft: "Brouillon (non publié)",
  pending: "En relecture (non publié)",
  published: "Publié",
  archived: "Archivé (retiré)",
} as const;
export type ArticleStatus = keyof typeof ARTICLE_STATUSES;

export const ARTICLE_VERIFICATIONS = {
  pending_validation: "À vérifier : publié avec la mention « à confirmer localement »",
  verified: "Vérifié auprès de la source indiquée",
  placeholder: "Exemple de démonstration",
} as const;
export type ArticleVerification = keyof typeof ARTICLE_VERIFICATIONS;

export const SOURCE_KINDS = {
  terrain: "Relevé de terrain",
  officiel: "Source officielle",
  partenaire: "Partenaire",
  declaratif: "Déclaration d’un tiers",
  publication: "Publication (presse, rapport)",
  autre: "Autre",
} as const;
export type SourceKind = keyof typeof SOURCE_KINDS;

export const SUGGESTION_DECISIONS = {
  reviewing: "En cours d’examen",
  resolved: "Prise en compte",
  dismissed: "Écartée",
} as const;
export type SuggestionDecision = keyof typeof SUGGESTION_DECISIONS;

export const MARKDOWN_HELP =
  "## Titre de partie, ### Sous-titre, - liste, 1. liste numérotée, > encadré d’avertissement, **gras**, *italique*, [lien](/page-du-site) ou [lien](https://…). Pas de HTML.";
