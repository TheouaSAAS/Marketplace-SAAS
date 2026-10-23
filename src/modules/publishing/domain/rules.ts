/**
 * Contenus interdits et signaux de fraude d'une annonce. Règles fixes et
 * expliquées (pas d'IA) : un motif bloquant empêche la soumission, et la
 * modération humaine reste la garantie finale (elle voit les mêmes signaux).
 */
import { normalize } from "./assistant";

export interface ListingRuleHit {
  rule: string;
  excerpt: string;
  advice: string;
}

interface Rule {
  rule: string;
  pattern: RegExp;
  advice: string;
}

/** Objets et services dont la vente est interdite ou réglementée. */
const FORBIDDEN: Rule[] = [
  { rule: "Armes et munitions", pattern: /\b(armes? a feu|pistolets?|fusils?|kalachnikov|munitions?|cartouches? de chasse|grenades?)\b/, advice: "La vente d’armes et de munitions est interdite sur la plateforme." },
  { rule: "Drogues", pattern: /\b(cannabis|beuh|cocaine|heroine|tramadol|kush|drogues?)\b/, advice: "Les stupéfiants et produits détournés sont interdits." },
  { rule: "Médicaments", pattern: /\b(vente de medicaments|medicaments? a vendre|antibiotiques?|viagra)\b/, advice: "Les médicaments ne se vendent qu’en pharmacie." },
  { rule: "Espèces protégées", pattern: /\b(ivoire|pangolins?|peaux? de (leopard|panthere)|carapaces? de tortue|chimpanzes?|perroquets? gris)\b/, advice: "Les espèces protégées et leurs dérivés ne peuvent pas être vendus." },
  { rule: "Faux documents ou contrefaçon", pattern: /\b(faux (billets?|papiers?|diplomes?|permis)|fausses? (cartes?|attestations?)|contrefacons?|replique de marque|copie conforme)\b/, advice: "Faux documents et contrefaçons sont interdits." },
  { rule: "Données personnelles", pattern: /\b(fichiers? clients?|bases? de donnees? (clients?|emails?)|numeros? de cartes? bancaires?)\b/, advice: "La vente de données personnelles est interdite." },
];

/** Formulations typiques des arnaques. */
const FRAUD: Rule[] = [
  { rule: "Paiement avant visite", pattern: /\b(frais de (visite|dossier|reservation) a (payer|verser)|payer avant (la )?visite|avance avant (de voir|visite)|caution avant visite)\b/, advice: "Ne demandez jamais d’argent avant une visite ou une remise en main propre." },
  { rule: "Transfert d’argent préalable", pattern: /\b(mobile money|orange money|mtn money|moov money|wave|western union|moneygram)\b.{0,40}\b(avant|d abord|prealable|avance)\b|\b(envoy|vers|transfer)\w* (d abord|avant|l avance)\b/, advice: "Pas de paiement à distance exigé avant d’avoir vu le bien." },
  { rule: "Promesse irréaliste", pattern: /\b(gain garanti|argent facile|devenez riche|doublez votre argent|investissement sans risque)\b/, advice: "Retirez les promesses de gain : elles sont typiques des arnaques." },
];

function scan(text: string, rules: Rule[]): ListingRuleHit[] {
  const normalized = normalize(text);
  return rules.flatMap(({ rule, pattern, advice }) => {
    const match = pattern.exec(normalized);
    return match ? [{ rule, excerpt: match[0], advice }] : [];
  });
}

/** Motifs bloquants (contenu interdit, fraude) d'une annonce. */
export function checkListing(text: string): ListingRuleHit[] {
  return [...scan(text, FORBIDDEN), ...scan(text, FRAUD)];
}

export const LISTING_RULES = [
  "Décrivez un bien ou un service réel, avec vos propres photos.",
  "Aucun objet interdit : armes, drogues, médicaments, espèces protégées, faux documents, contrefaçons.",
  "Ne demandez jamais d’argent avant une visite ou une remise en main propre.",
  "Chaque annonce est relue par l’équipe de modération avant publication.",
];
