import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { CATEGORY_FAMILY_LABELS, type AdminCategory, type CategoryFamily, type CategoryUsage } from "../domain/categories";

const adminCategorySchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  family: z.enum(Object.keys(CATEGORY_FAMILY_LABELS) as [CategoryFamily, ...CategoryFamily[]]),
  slug: z.string(),
  name: z.string(),
  sort_order: z.number(),
  is_active: z.boolean(),
  keywords: z.array(z.string()),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  content_types: z.array(z.string()),
  attribute_schema: z.string().nullable(),
  attribute_fields: z.array(z.string()).nullable(),
});

/** Toutes les catégories, inactives comprises (lisibles par l'équipe seulement, règles de la base). */
export async function listAllCategories(): Promise<AdminCategory[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, family, slug, name, sort_order, is_active, keywords, description, icon, content_types, attribute_schema, attribute_fields")
    .order("sort_order");
  if (error) throw new Error(`Lecture du référentiel impossible : ${error.message}`);
  return z.array(adminCategorySchema).parse(data);
}

const usageSchema = z.object({
  category_id: z.uuid(),
  children: z.number(),
  listings_published: z.number(),
  listings_other: z.number(),
  places: z.number(),
  events: z.number(),
  businesses: z.number(),
});

/** Contenus rattachés à chaque catégorie (administrateurs seulement, vérifié par la base). */
export async function categoryUsage(): Promise<Map<string, CategoryUsage>> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return new Map();
  const { data, error } = await supabase.rpc("admin_category_usage");
  if (error) throw new Error(`Lecture de l'utilisation des catégories impossible : ${error.message}`);
  return new Map(
    z.array(usageSchema).parse(data).map((row) => [
      row.category_id,
      {
        children: row.children,
        listingsPublished: row.listings_published,
        listingsOther: row.listings_other,
        places: row.places,
        events: row.events,
        businesses: row.businesses,
      },
    ]),
  );
}
