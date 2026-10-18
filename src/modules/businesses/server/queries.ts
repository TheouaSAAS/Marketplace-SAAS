import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { orderByIds } from "@/modules/shared/server/by-ids";
import { categoryRefSchema, neighborhoodRefSchema, single, verificationStatusSchema } from "@/modules/shared/server/schemas";

export const BUSINESSES_CACHE_TAG = "businesses";

const businessCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  updated_at: z.string(),
  category: single(categoryRefSchema.nullable()),
  neighborhood: single(neighborhoodRefSchema),
});

export type BusinessCardData = z.infer<typeof businessCardSchema>;

/**
 * Fiches professionnelles publiées par identifiants, dans l'ordre donné.
 * Colonnes publiques uniquement (l'adresse et la position exacte sont
 * illisibles par l'API).
 */
export async function listBusinessesByIds(ids: readonly string[]): Promise<BusinessCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(BUSINESSES_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, slug, name, description, verification_status, verified_at, updated_at, category:categories(name, slug, icon), neighborhood:neighborhoods(name)",
    )
    .eq("status", "published")
    .in("id", [...ids]);
  if (error) throw new Error(`Lecture des professionnels impossible : ${error.message}`);
  return orderByIds(z.array(businessCardSchema).parse(data), ids);
}
