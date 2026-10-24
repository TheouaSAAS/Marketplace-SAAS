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
  description: string | null;
  icon: string | null;
  content_types: string[];
  attribute_schema: string | null;
  /** Champs du schéma activés (null : tous). */
  attribute_fields: string[] | null;
}

/** Rubrique principale, sous-rubrique, sous-catégorie, catégorie détaillée (règle garantie par la base). */
export const MAX_CATEGORY_DEPTH = 4;
export const DEPTH_LABELS = ["Rubrique principale", "Sous-rubrique", "Sous-catégorie", "Catégorie détaillée"] as const;

/** Contenus rattachés à une catégorie (fonction `admin_category_usage`). */
export interface CategoryUsage {
  children: number;
  listingsPublished: number;
  listingsOther: number;
  places: number;
  events: number;
  businesses: number;
}

export const NO_USAGE: CategoryUsage = { children: 0, listingsPublished: 0, listingsOther: 0, places: 0, events: 0, businesses: 0 };

/** Total des contenus à reprendre avant une suppression (les sous-catégories se déplacent à part). */
export function usageTotal(usage: CategoryUsage): number {
  return usage.listingsPublished + usage.listingsOther + usage.places + usage.events + usage.businesses;
}

function descendants(all: readonly AdminCategory[], id: string): Set<string> {
  const found = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const item of all) {
      if (item.parent_id === parent && !found.has(item.id)) {
        found.add(item.id);
        queue.push(item.id);
      }
    }
  }
  return found;
}

/** Niveaux occupés par la catégorie et ses descendants (1 : aucune sous-catégorie). */
function subtreeHeight(all: readonly AdminCategory[], id: string): number {
  const kids = all.filter((item) => item.parent_id === id);
  return 1 + Math.max(0, ...kids.map((kid) => subtreeHeight(all, kid.id)));
}

/**
 * Parents possibles pour déplacer une catégorie : même famille, ni elle-même
 * ni une descendante, et sans dépasser quatre niveaux avec ses sous-catégories.
 */
export function moveTargets(all: readonly AdminCategory[], category: AdminCategory): CategoryNode[] {
  const excluded = descendants(all, category.id).add(category.id);
  const height = subtreeHeight(all, category.id);
  const group = categoryForest(all).find((item) => item.family === category.family);
  return (group?.nodes ?? []).filter(({ category: target, depth }) => !excluded.has(target.id) && depth + 1 + height <= MAX_CATEGORY_DEPTH);
}

/** Catégories pouvant reprendre les contenus d'une catégorie supprimée : même famille, actives, hors elle-même. */
export function replacementTargets(all: readonly AdminCategory[], category: AdminCategory): CategoryNode[] {
  const group = categoryForest(all).find((item) => item.family === category.family);
  return (group?.nodes ?? []).filter(({ category: target }) => target.id !== category.id && target.is_active);
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
