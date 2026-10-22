/**
 * « Ma climatisation ne fonctionne plus » → métier « Climatisation ».
 * La correspondance repose UNIQUEMENT sur les mots-clés des métiers, gérés
 * dans le référentiel (administration) : aucune règle cachée dans le code.
 * Le mot-clé le plus long l'emporte (« panne de courant » avant « panne »).
 */

export interface Trade {
  slug: string;
  name: string;
  keywords: readonly string[];
}

export interface NeedInterpretation {
  trade: Trade | null;
  /** Mot-clé reconnu, pour l'expliquer à l'utilisateur. */
  matched: string | null;
  /** Urgence exprimée : affichée, jamais transformée en promesse de disponibilité. */
  urgent: boolean;
}

export function normalizeText(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

const URGENT = / (urgent|urgence|vite|tout de suite|immediatement|ce soir) /;

export function interpretNeed(text: string, trades: readonly Trade[]): NeedInterpretation {
  const normalized = normalizeText(text);
  let best: { trade: Trade; keyword: string } | null = null;
  for (const trade of trades) {
    for (const keyword of [trade.name, ...trade.keywords]) {
      const needle = normalizeText(keyword);
      if (needle.trim() && normalized.includes(needle) && (!best || needle.length > normalizeText(best.keyword).length)) {
        best = { trade, keyword };
      }
    }
  }
  return { trade: best?.trade ?? null, matched: best?.keyword ?? null, urgent: URGENT.test(normalized) };
}
