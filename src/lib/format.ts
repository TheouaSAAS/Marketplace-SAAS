/**
 * Formats d'affichage en français de Côte d'Ivoire.
 * Fuseau : Africa/Abidjan (UTC+0, sans heure d'été) pour que serveur et
 * navigateur affichent la même date.
 */

const TIME_ZONE = "Africa/Abidjan";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });
const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function toDate(value: Date | string): Date | null {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** « 17 octobre 2026 » */
export function formatDate(value: Date | string, style: "long" | "short" = "long"): string {
  const date = toDate(value);
  if (!date) return "Date inconnue";
  return (style === "short" ? shortDateFormatter : dateFormatter).format(date);
}

/** « samedi 17 octobre à 20:00 » */
export function formatDateTime(value: Date | string): string {
  const date = toDate(value);
  if (!date) return "Date inconnue";
  return dateTimeFormatter.format(date);
}

const PRICE_UNITS = {
  total: "",
  par_mois: " / mois",
  par_jour: " / jour",
  par_nuit: " / nuit",
  par_heure: " / heure",
  a_partir_de: "",
} as const;

export type PriceUnit = keyof typeof PRICE_UNITS;

/**
 * « 150 000 FCFA / mois ». Un prix absent n'est jamais remplacé par une
 * estimation : on affiche « Prix non communiqué ».
 */
export function formatPrice(amount: number | null | undefined, unit: PriceUnit = "total"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount < 0) return "Prix non communiqué";
  if (amount === 0) return "Gratuit";
  const value = `${numberFormatter.format(amount)} FCFA${PRICE_UNITS[unit]}`;
  return unit === "a_partir_de" ? `À partir de ${value}` : value;
}
