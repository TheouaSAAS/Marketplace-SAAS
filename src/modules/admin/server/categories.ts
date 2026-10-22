import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { CATEGORY_FAMILY_LABELS, type AdminCategory, type CategoryFamily } from "../domain/categories";

const adminCategorySchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  family: z.enum(Object.keys(CATEGORY_FAMILY_LABELS) as [CategoryFamily, ...CategoryFamily[]]),
  slug: z.string(),
  name: z.string(),
  sort_order: z.number(),
  is_active: z.boolean(),
  keywords: z.array(z.string()),
});

/** Toutes les catégories, inactives comprises (lisibles par l'équipe seulement, règles de la base). */
export async function listAllCategories(): Promise<AdminCategory[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, family, slug, name, sort_order, is_active, keywords")
    .order("sort_order");
  if (error) throw new Error(`Lecture du référentiel impossible : ${error.message}`);
  return z.array(adminCategorySchema).parse(data);
}
