/**
 * Annonces similaires : règles fixes et affichées, sans profilage.
 * Candidates : annonces publiées de la même ville et de la même famille de
 * catégories. Points : même catégorie (3), même quartier (2), prix déclaré à
 * ±30 % (1). Il faut au moins la même catégorie OU deux autres critères.
 * Égalité : la plus récente d'abord. Les autres annonces du même annonceur
 * sont présentées à part.
 */

export const SIMILAR_RULE =
  "Annonces publiées dans la même ville et la même famille de catégories, classées par critères communs : même catégorie, même quartier, prix déclaré proche (±30 %), puis les plus récentes. Aucune annonce n’est mise en avant contre paiement.";

export interface SimilarInput {
  id: string;
  ownerId: string;
  categoryId: string;
  neighborhoodId: string | null;
  price: number | null;
  publishedAt: string | null;
}

export interface SimilarMatch {
  id: string;
  reasons: string[];
}

const MIN_SCORE = 3;

export function rankSimilar(target: SimilarInput, candidates: readonly SimilarInput[], limit = 4): SimilarMatch[] {
  return candidates
    .filter((candidate) => candidate.id !== target.id && candidate.ownerId !== target.ownerId)
    .map((candidate) => {
      const reasons: string[] = [];
      let score = 0;
      if (candidate.categoryId === target.categoryId) {
        score += 3;
        reasons.push("Même catégorie");
      }
      if (target.neighborhoodId && candidate.neighborhoodId === target.neighborhoodId) {
        score += 2;
        reasons.push("Même quartier");
      }
      if (target.price !== null && target.price > 0 && candidate.price !== null && Math.abs(candidate.price - target.price) <= target.price * 0.3) {
        score += 1;
        reasons.push("Prix proche");
      }
      return { candidate, score, reasons };
    })
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || (b.candidate.publishedAt ?? "").localeCompare(a.candidate.publishedAt ?? ""))
    .slice(0, limit)
    .map(({ candidate, reasons }) => ({ id: candidate.id, reasons }));
}
