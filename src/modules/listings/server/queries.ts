import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { orderByIds } from "@/modules/shared/server/by-ids";
import { categoryRefSchema, neighborhoodRefSchema, single, verificationStatusSchema } from "@/modules/shared/server/schemas";

export const LISTINGS_CACHE_TAG = "listings";

export const listingCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  price: z.number().nullable(),
  price_unit: z.enum(["total", "par_mois", "par_jour", "par_nuit", "par_heure", "a_partir_de"]).nullable(),
  availability_status: z.enum(["available", "reserved", "unavailable", "unknown"]),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  published_at: z.string().nullable(),
  last_confirmed_at: z.string().nullable(),
  category: single(categoryRefSchema),
  neighborhood: single(neighborhoodRefSchema),
});

export type ListingCardData = z.infer<typeof listingCardSchema>;

export const LISTING_CARD_COLUMNS =
  "id, slug, title, price, price_unit, availability_status, verification_status, verified_at, published_at, last_confirmed_at, category:categories(name, slug, icon), neighborhood:neighborhoods(name)";

/** Annonces publiées les plus récentes d'une ville, limitées à des catégories (identifiants). */
export async function listListingsByCategories(cityId: string, categoryIds: readonly string[], limit = 3): Promise<ListingCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_CACHE_TAG, `${LISTINGS_CACHE_TAG}:${cityId}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase || categoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_CARD_COLUMNS)
    .eq("city_id", cityId)
    .eq("status", "published")
    .in("category_id", [...categoryIds])
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Lecture des annonces impossible : ${error.message}`);
  return z.array(listingCardSchema).parse(data);
}

/** Annonces publiées par identifiants, dans l'ordre donné (résultats de recherche). */
export async function listListingsByIds(ids: readonly string[]): Promise<ListingCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase.from("listings").select(LISTING_CARD_COLUMNS).eq("status", "published").in("id", [...ids]);
  if (error) throw new Error(`Lecture des annonces impossible : ${error.message}`);
  return orderByIds(z.array(listingCardSchema).parse(data), ids);
}

/**
 * Annonces publiées les plus récentes d'une ville. Colonnes publiques
 * uniquement (la position exacte et les contacts sont illisibles par l'API).
 * Les règles d'accès filtrent déjà les annonces expirées et les exemples
 * masqués ; aucun filtre de visibilité n'est dupliqué ici.
 */
export async function listRecentListings(cityId: string, limit = 6): Promise<ListingCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_CACHE_TAG, `${LISTINGS_CACHE_TAG}:${cityId}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_CARD_COLUMNS)
    .eq("city_id", cityId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Lecture des annonces impossible : ${error.message}`);
  return z.array(listingCardSchema).parse(data);
}
