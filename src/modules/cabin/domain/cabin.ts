/**
 * Cabine en ligne : règles pures (frais, numéros, compteurs, états), sans accès
 * à la base. Les frais affichés ici sont recalculés par la base au moment de la
 * confirmation (`public.cabin_fee`) : un écart impose une nouvelle confirmation.
 */

export const CABIN_SERVICES = ["airtime", "airtime_transfer", "data", "electricity", "money_transfer"] as const;
export type CabinService = (typeof CABIN_SERVICES)[number];

export type NetworkKind = "telecom" | "mobile_money" | "utility";

export const CABIN_STATUSES = ["created", "pending", "processing", "awaiting_confirmation", "succeeded", "failed", "cancelled", "expired", "refunded"] as const;
export type CabinStatus = (typeof CABIN_STATUSES)[number];

/** Familles présentées au visiteur (étape 1). */
export const SERVICE_FAMILIES: { title: string; services: CabinService[] }[] = [
  { title: "Crédit et unités", services: ["airtime", "airtime_transfer"] },
  { title: "Offres Internet", services: ["data"] },
  { title: "Électricité CIE", services: ["electricity"] },
  { title: "Transfert d’argent", services: ["money_transfer"] },
];

export interface ServiceShape {
  /** Type de réseau à choisir à l'étape 2. */
  networkKind: NetworkKind;
  /** Ce qu'identifie le destinataire. */
  recipient: "phone" | "meter";
  /** Numéro de l'expéditeur demandé (portefeuille ou ligne débités par le parcours du fournisseur). */
  sender: boolean;
  /** Montant choisi dans le catalogue d'offres plutôt que saisi. */
  usesOffers: boolean;
  /** Montants proposés en raccourci. */
  quickAmounts: number[];
}

export const SERVICE_SHAPES: Record<CabinService, ServiceShape> = {
  airtime: { networkKind: "telecom", recipient: "phone", sender: false, usesOffers: false, quickAmounts: [500, 1000, 2000, 5000] },
  airtime_transfer: { networkKind: "telecom", recipient: "phone", sender: true, usesOffers: false, quickAmounts: [500, 1000, 2000] },
  data: { networkKind: "telecom", recipient: "phone", sender: false, usesOffers: true, quickAmounts: [] },
  electricity: { networkKind: "utility", recipient: "meter", sender: false, usesOffers: false, quickAmounts: [2000, 5000, 10000, 20000] },
  money_transfer: { networkKind: "mobile_money", recipient: "phone", sender: true, usesOffers: false, quickAmounts: [5000, 10000, 25000, 50000] },
};

export const STATUS_META: Record<CabinStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info"; final: boolean; explanation: string }> = {
  created: { label: "Créée", tone: "info", final: false, explanation: "L’opération est enregistrée et va être transmise." },
  pending: { label: "Paiement en cours", tone: "info", final: false, explanation: "Autorisez le paiement dans le parcours sécurisé de votre opérateur. Ne communiquez jamais votre code secret." },
  processing: { label: "En cours de traitement", tone: "info", final: false, explanation: "Le prestataire exécute l’opération." },
  awaiting_confirmation: {
    label: "En attente de confirmation",
    tone: "warning",
    final: false,
    explanation: "Le résultat n’est pas encore confirmé par le prestataire. Ne relancez pas l’opération : vous pourriez être débité deux fois.",
  },
  succeeded: { label: "Réussie", tone: "success", final: true, explanation: "Le prestataire a confirmé l’opération." },
  failed: { label: "Échouée", tone: "danger", final: true, explanation: "Le prestataire a refusé ou n’a pas pu exécuter l’opération." },
  cancelled: { label: "Annulée", tone: "neutral", final: true, explanation: "L’opération n’a pas été exécutée." },
  expired: { label: "Expirée", tone: "neutral", final: true, explanation: "Aucune confirmation n’a été reçue dans le délai : rien n’a été relancé." },
  refunded: { label: "Remboursée", tone: "neutral", final: true, explanation: "Le montant a été remboursé par le prestataire." },
};

/** Frais de service en points de base (50 = 0,5 %), arrondis au franc CFA entier le plus proche, demi-franc vers le haut. */
export function serviceFee(amount: number, feeBps: number): number {
  return Math.floor((amount * feeBps + 5000) / 10000);
}

export interface Totals {
  amount: number;
  serviceFee: number;
  providerFee: number;
  total: number;
}

export function totals(amount: number, feeBps: number, providerFee = 0): Totals {
  const fee = serviceFee(amount, feeBps);
  return { amount, serviceFee: fee, providerFee, total: amount + fee + providerFee };
}

/** Taux lisible : 50 points de base → « 0,5 % ». */
export function feeRateLabel(feeBps: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(feeBps / 100)} %`;
}

export function formatXof(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} F CFA`;
}

/** Numéro ivoirien à 10 chiffres (indicatif +225 / 00225 accepté), ou null. */
export function normalizeCiPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+225")) digits = digits.slice(4);
  else if (digits.startsWith("00225")) digits = digits.slice(5);
  return /^0[157]\d{8}$/.test(digits) ? digits : null;
}

/** Préfixe d'origine du numéro (sans tenir compte de la portabilité : simple indication). */
export function prefixNetwork(phone: string): "moov" | "mtn" | "orange" | null {
  const prefix = phone.slice(0, 2);
  return prefix === "01" ? "moov" : prefix === "05" ? "mtn" : prefix === "07" ? "orange" : null;
}

/** « 07 ** ** ** 12 » : assez pour vérifier, pas assez pour exposer le numéro. */
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 2)} ** ** ** ${phone.slice(-2)}`;
}

/** Numéro de compteur : chiffres uniquement ; la longueur exacte est fixée par le fournisseur. */
export function normalizeMeter(input: string): string | null {
  const digits = input.replace(/[\s.\-]/g, "");
  return /^\d{8,20}$/.test(digits) ? digits : null;
}

export function maskMeter(meter: string): string {
  return `${"*".repeat(Math.max(4, meter.length - 4))}${meter.slice(-4)}`;
}
