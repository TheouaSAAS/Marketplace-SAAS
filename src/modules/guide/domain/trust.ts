/**
 * Fraîcheur et statut d'un article du guide, tels qu'annoncés au lecteur.
 * Un contenu non vérifié n'est jamais présenté comme une certitude.
 */
import { VERIFICATION_VALIDITY_DAYS, type VerificationStatus } from "@/domain/verification";

export type ArticleTrust =
  | { kind: "verified"; verifiedAt: string }
  | { kind: "stale"; verifiedAt: string }
  | { kind: "unverified" }
  | { kind: "example" };

export function articleTrust(status: VerificationStatus, verifiedAt: string | null, now: Date): ArticleTrust {
  if (status === "placeholder") return { kind: "example" };
  if (status !== "verified" || !verifiedAt) return { kind: "unverified" };
  const ageDays = (now.getTime() - new Date(verifiedAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays <= VERIFICATION_VALIDITY_DAYS.default ? { kind: "verified", verifiedAt } : { kind: "stale", verifiedAt };
}

export const TRUST_NOTICES: Record<ArticleTrust["kind"], { title: string; body: string; tone: "success" | "warning" | "info" }> = {
  verified: {
    title: "Informations vérifiées",
    body: "L’équipe locale a contrôlé cet article auprès de la source indiquée. Les situations évoluent : en cas de doute, confirmez sur place.",
    tone: "success",
  },
  stale: {
    title: "Vérification ancienne",
    body: "La dernière vérification date de plus d’un an : certaines informations ont pu changer. Confirmez-les localement.",
    tone: "warning",
  },
  unverified: {
    title: "Contenu à confirmer localement",
    body: "Cet article n’a pas encore été vérifié par l’équipe locale : ne le prenez pas pour une certitude et confirmez les informations sur place.",
    tone: "warning",
  },
  example: {
    title: "Exemple de démonstration",
    body: "Ce texte est un gabarit fictif qui sert à tester la plateforme : il ne contient aucune information réelle.",
    tone: "warning",
  },
};

/** Avertissement présent sur chaque article (cahier des charges, niveau 13). */
export const GUIDE_DISCLAIMER =
  "Information générale d’orientation : ce n’est pas un conseil juridique, médical, administratif ou financier personnalisé. Pour votre situation, adressez-vous à un professionnel ou au service compétent.";
