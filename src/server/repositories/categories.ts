import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const CATEGORIES_CACHE_TAG = "categories";

const categorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  parent_id: z.uuid().nullable(),
  icon: z.string().nullable(),
  sort_order: z.number(),
  content_types: z.array(z.enum(["listing", "place", "event", "business"])),
  attribute_schema: z.string().nullable(),
  /** Champs du schéma activés pour cette catégorie (null : tous). */
  attribute_fields: z.array(z.string()).nullable(),
  description: z.string().nullable(),
  keywords: z.array(z.string()),
});

export type Category = z.infer<typeof categorySchema>;

/**
 * Catégories actives (référentiel géré depuis l'administration). Données
 * publiques mises en cache ; l'administration invalide le tag `categories`.
 * Retourne [] si Supabase n'est pas configuré ; lève une erreur si la base répond mal.
 */
export async function listCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATEGORIES_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, parent_id, icon, sort_order, content_types, attribute_schema, attribute_fields, description, keywords")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`Lecture des catégories impossible : ${error.message}`);
  return z.array(categorySchema).parse(data);
}

/** Identifiants des catégories demandées ET de toutes leurs sous-catégories. */
export function categoryIdsWithDescendants(all: Category[], slugs: readonly string[]): string[] {
  const ids = new Set(all.filter((category) => slugs.includes(category.slug)).map((category) => category.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of all) {
      if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id);
        grew = true;
      }
    }
  }
  return [...ids];
}

/** Catégories demandées (par slug) et leurs sous-catégories, dans l'ordre d'affichage. */
export function selectCategoryTree(all: Category[], parentSlugs: readonly string[]): { parent: Category; children: Category[] }[] {
  return parentSlugs.flatMap((slug) => {
    const parent = all.find((category) => category.slug === slug);
    if (!parent) return [];
    return [{ parent, children: all.filter((category) => category.parent_id === parent.id) }];
  });
}

/** Ancêtres d'une catégorie, de la rubrique principale jusqu'à elle (fil d'Ariane). */
export function categoryPath(all: readonly Category[], id: string): Category[] {
  const byId = new Map(all.map((category) => [category.id, category]));
  const path: Category[] = [];
  let current = byId.get(id);
  while (current && path.length < 6) {
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}
