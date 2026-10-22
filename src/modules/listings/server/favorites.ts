import "server-only";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { listListingsByIds, type ListingCardData } from "./queries";

/**
 * Annonces mises en favori par la personne connectée, les plus récentes
 * d'abord. Une annonce devenue indisponible (expirée, retirée) n'est plus
 * lisible publiquement : elle est comptée à part, sans détail.
 */
export async function listFavoriteListings(userId: string): Promise<{ listings: ListingCardData[]; unavailable: number }> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { listings: [], unavailable: 0 };
  const { data, error } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", userId)
    .not("listing_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Lecture des favoris impossible : ${error.message}`);
  const ids = data.flatMap((row) => (row.listing_id ? [row.listing_id] : []));
  const listings = await listListingsByIds(ids);
  return { listings, unavailable: ids.length - listings.length };
}
