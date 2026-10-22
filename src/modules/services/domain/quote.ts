/** Délai souhaité d'une demande de devis (indicatif, jamais une promesse). */
export const QUOTE_TIMINGS = {
  urgent: "Urgent (dès que possible)",
  semaine: "Dans la semaine",
  mois: "Dans le mois",
  a_definir: "À définir",
} as const;

export type QuoteTiming = keyof typeof QUOTE_TIMINGS;

export const QUOTE_CONSENT =
  "J’accepte que mon nom et les coordonnées indiquées ci-dessus soient transmis à ce professionnel pour qu’il réponde à ma demande.";
