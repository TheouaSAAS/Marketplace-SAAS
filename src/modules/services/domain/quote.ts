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

/** Suivi d'une demande ; seul le destinataire change le statut (règle en base). */
export const QUOTE_STATUSES = {
  new: { label: "Nouvelle", tone: "info" },
  read: { label: "Lue", tone: "neutral" },
  replied: { label: "Répondue", tone: "success" },
  archived: { label: "Archivée", tone: "neutral" },
} as const;

export type QuoteStatus = keyof typeof QUOTE_STATUSES;

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && Object.hasOwn(QUOTE_STATUSES, value);
}

/** Détails structurés d'une demande, lus avec prudence (colonne JSON libre). */
export function quoteDetails(details: Record<string, unknown>): { prestation: string | null; quand: string | null; quartier: string | null } {
  const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
  const quand = text(details.quand);
  return {
    prestation: text(details.prestation),
    quand: quand && Object.hasOwn(QUOTE_TIMINGS, quand) ? QUOTE_TIMINGS[quand as QuoteTiming] : null,
    quartier: text(details.quartier),
  };
}
