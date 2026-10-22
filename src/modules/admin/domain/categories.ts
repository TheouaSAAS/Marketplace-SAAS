/**
 * Référentiel des catégories (métiers, rubriques, types de commerces…) tel
 * que l'administration le gère. Règles pures, testables sans base.
 */

export const MAX_KEYWORDS = 60;
const MAX_KEYWORD_LENGTH = 60;

export const CATEGORY_FAMILY_LABELS = {
  trouver: "Annonces et opportunités",
  decouvrir: "Découvrir et sortir",
  entreprendre: "Services, commerces et professionnels",
} as const;

export type CategoryFamily = keyof typeof CATEGORY_FAMILY_LABELS;

export interface AdminCategory {
  id: string;
  parent_id: string | null;
  family: CategoryFamily;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  keywords: string[];
}

export interface CategoryNode {
  category: AdminCategory;
  depth: number;
}

/** Mots-clés saisis séparés par des virgules ou des retours à la ligne : nettoyés, en minuscules, sans doublon. */
export function parseKeywords(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/[,\n;]/)) {
    const keyword = raw.replace(/\s+/g, " ").trim().toLowerCase();
    if (keyword && keyword.length <= MAX_KEYWORD_LENGTH) seen.add(keyword);
  }
  return [...seen].slice(0, MAX_KEYWORDS);
}

/** Identifiant d'adresse dérivé d'un nom : « Fruits & légumes » → « fruits-legumes ». */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Arbre aplati (parents puis enfants, dans l'ordre d'affichage), par famille. */
export function categoryForest(all: readonly AdminCategory[]): { family: CategoryFamily; nodes: CategoryNode[] }[] {
  const byOrder = (a: AdminCategory, b: AdminCategory) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "fr");
  const children = (parentId: string | null) => all.filter((category) => category.parent_id === parentId).sort(byOrder);
  const walk = (category: AdminCategory, depth: number, seen: Set<string>): CategoryNode[] => {
    if (seen.has(category.id)) return [];
    seen.add(category.id);
    return [{ category, depth }, ...children(category.id).flatMap((child) => walk(child, depth + 1, seen))];
  };
  return (Object.keys(CATEGORY_FAMILY_LABELS) as CategoryFamily[])
    .map((family) => {
      const seen = new Set<string>();
      return { family, nodes: children(null).filter((root) => root.family === family).flatMap((root) => walk(root, 0, seen)) };
    })
    .filter((group) => group.nodes.length > 0);
}
