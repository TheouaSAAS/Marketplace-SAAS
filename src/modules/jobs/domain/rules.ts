/**
 * Règles de publication d'une offre : formulations discriminatoires,
 * trompeuses ou frauduleuses. Règles fixes et expliquées (pas d'IA) ; une
 * formulation bloquante empêche l'envoi, un signal est montré aux modérateurs.
 * La modération humaine reste la garantie finale.
 */

export interface RuleHit {
  rule: string;
  excerpt: string;
  advice: string;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

interface Rule {
  rule: string;
  pattern: RegExp;
  advice: string;
}

/** Critères interdits à l'embauche (âge, sexe, origine, religion, situation familiale, apparence, santé). */
const DISCRIMINATION: Rule[] = [
  { rule: "Limite d’âge", pattern: /\b(age|agee?s?) (maximum|minimum|max|min|de moins de|de plus de|entre)\b|\b(moins|plus) de \d{2} ans\b|\b\d{2} ans (maximum|max|au plus|au maximum)\b/, advice: "L’âge n’est pas un critère : décrivez l’expérience ou les compétences attendues." },
  { rule: "Sexe imposé", pattern: /\b(homme|hommes|femme|femmes|masculin|feminin|fille|garcon)s? (uniquement|seulement|exclusivement)\b|\b(uniquement|seulement|exclusivement) (des )?(hommes?|femmes?|filles?|garcons?)\b|\bsexe (masculin|feminin)\b/, advice: "Le poste est ouvert à tous : retirez la mention du sexe." },
  { rule: "Origine, ethnie ou nationalité", pattern: /\b(ethnie|ethnique|origine ethnique|tribu)\b|\bnationalite (ivoirienne|etrangere) (exigee|obligatoire|uniquement)\b|\b(ivoiriens?|etrangers?) (uniquement|seulement|exclusivement)\b/, advice: "L’origine ou la nationalité ne sont pas des critères (sauf obligation légale, à justifier auprès de l’équipe)." },
  { rule: "Religion", pattern: /\b(religion|chretiens?|musulmans?|catholiques?|protestants?) (exigee?s?|obligatoires?|uniquement|seulement|de preference)\b/, advice: "La religion n’est pas un critère d’embauche." },
  { rule: "Situation familiale", pattern: /\b(celibataire|marie|mariee|sans enfants?|pas d.enfants?|enceinte|grossesse)\b/, advice: "La situation familiale ou une grossesse ne sont pas des critères." },
  { rule: "Apparence physique", pattern: /\b(belle|beau|jolie|physique (agreable|avantageux)|bonne presentation physique|teint clair|taille minimum)\b/, advice: "L’apparence n’est pas un critère : décrivez la tenue professionnelle attendue si nécessaire." },
  { rule: "Santé ou handicap", pattern: /\b(pas de handicap|sans handicap|handicapes? exclus|bonne sante exigee)\b/, advice: "Le handicap ou l’état de santé ne sont pas des critères (aptitude vérifiée par la médecine du travail)." },
];

/** Signes d'arnaque à l'emploi : paiement demandé au candidat, gains irréalistes. */
const FRAUD: Rule[] = [
  { rule: "Paiement demandé au candidat", pattern: /\b(frais de (dossier|candidature|formation|inscription|traitement|visite medicale)|payer pour (postuler|etre recrute)|versement (prealable|initial)|cotisation d.entree|caution (a|de) (verser|payer))\b/, advice: "Un employeur ne fait jamais payer une candidature : ce type d’offre est refusé." },
  { rule: "Transfert d’argent", pattern: /\b(mobile money|orange money|mtn money|moov money|wave|western union|moneygram)\b.{0,40}\b(envoy|vers|transfer|pay)\w*|\b(envoy|vers|transfer|pay)\w*\b.{0,40}\b(mobile money|orange money|mtn money|moov money|wave|western union|moneygram)\b/, advice: "Aucune somme ne doit être demandée au candidat." },
  { rule: "Gains irréalistes", pattern: /\b(gagnez|gagner|revenus?) .{0,30}\b(sans effort|sans experience|garanti|par jour|en quelques jours|rapidement)\b|\b(argent facile|devenez riche)\b/, advice: "Décrivez la rémunération réelle, sans promesse de gain garanti." },
];

function scan(text: string, rules: Rule[]): RuleHit[] {
  const normalized = normalize(text);
  return rules.flatMap(({ rule, pattern, advice }) => {
    const match = pattern.exec(normalized);
    return match ? [{ rule, excerpt: match[0], advice }] : [];
  });
}

/** Formulations bloquantes : discrimination et fraude. */
export function checkOffer(text: string): RuleHit[] {
  return [...scan(text, DISCRIMINATION), ...scan(text, FRAUD)];
}

/** Rappel affiché sur le formulaire de publication. */
export const PUBLICATION_RULES = [
  "Pas de critère d’âge, de sexe, d’origine, de religion, de situation familiale, d’apparence ou de santé.",
  "Aucun frais demandé au candidat, sous aucune forme.",
  "Une rémunération réelle, sans promesse de gain garanti.",
  "Chaque offre est relue par l’équipe de modération avant publication.",
];
