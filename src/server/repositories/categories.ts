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
    .select("id, slug, name, parent_id, icon, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`Lecture des catégories impossible : ${error.message}`);
  return z.array(categorySchema).parse(data);
}

/** Catégories demandées (par slug) et leurs sous-catégories, dans l'ordre d'affichage. */
export function selectCategoryTree(all: Category[], parentSlugs: readonly string[]): { parent: Category; children: Category[] }[] {
  return parentSlugs.flatMap((slug) => {
    const parent = all.find((category) => category.slug === slug);
    if (!parent) return [];
    return [{ parent, children: all.filter((category) => category.parent_id === parent.id) }];
  });
}
