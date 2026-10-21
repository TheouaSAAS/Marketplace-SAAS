/** Motifs de signalement (valeurs de l'enum SQL `public.report_reason`). */
export const REPORT_REASONS = {
  arnaque: "Arnaque ou tentative de fraude",
  informations_erronees: "Informations fausses ou trompeuses",
  contenu_inapproprie: "Contenu inapproprié ou offensant",
  doublon: "Annonce en double",
  autre: "Autre raison",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;
export const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]];
