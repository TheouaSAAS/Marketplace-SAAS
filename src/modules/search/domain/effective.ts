import type { Interpretation } from "./natural-language";
import { normalizeForType, type SearchParams } from "./params";

/** La recherche porte-t-elle déjà des critères structurés (au-delà du texte et du type) ? */
export function hasExplicitCriteria(params: SearchParams): boolean {
  return (
    params.categorie !== null ||
    params.quartier !== null ||
    params.verifie ||
    params.prixMin !== null ||
    params.prixMax !== null ||
    params.dispo ||
    params.annonceur !== null ||
    params.quand !== null ||
    params.rayon !== null ||
    params.tri !== null ||
    params.page > 1
  );
}

/**
 * Recherche réellement exécutée. Une phrase n'est interprétée que lors d'une
 * saisie libre (aucun critère structuré dans l'adresse, pas de demande de
 * texte exact) ; un type déjà choisi qui contredit l'interprétation l'emporte
 * et la phrase est alors recherchée telle quelle. Les liens de la page sont
 * construits à partir du résultat : l'adresse devient explicite au premier clic.
 */
export function resolveSearch(
  params: SearchParams,
  interpretation: Interpretation | null,
  hasPosition: boolean,
): { params: SearchParams; interpretation: Interpretation | null } {
  if (!interpretation || params.brut || !params.q || hasExplicitCriteria(params)) return { params, interpretation: null };
  const { filters } = interpretation;
  if (params.type && filters.type && params.type !== filters.type) return { params, interpretation: null };

  const type = params.type ?? filters.type ?? null;
  const resolved = normalizeForType({
    ...params,
    ...filters,
    type,
    q: interpretation.keywords,
    tri: filters.tri ?? (interpretation.near && hasPosition && type ? "proximite" : null),
  });
  const changed = resolved.q !== params.q || interpretation.understood.length > 0;
  return { params: resolved, interpretation: changed ? interpretation : null };
}
