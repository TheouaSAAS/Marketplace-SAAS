import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { rankPlaces } from "@/domain/recommendation";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { neighborhoodRefSchema, single, verificationStatusSchema } from "@/modules/shared/server/schemas";

export const PLACES_CACHE_TAG = "places";

const placeCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  summary: z.string().nullable(),
  kind: z.enum(["etablissement", "lieu_touristique"]),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  updated_at: z.string(),
  category: single(z.object({ name: z.string(), slug: z.string(), icon: z.string().nullable(), family: z.string() })),
  neighborhood: single(neighborhoodRefSchema),
});

export type PlaceCardData = z.infer<typeof placeCardSchema>;

/**
 * Lieux publiés d'une ville pour une famille de catégories
 * (« decouvrir » : tourisme, restaurants, sorties ; « trouver » : commerces et
 * services). Classement explicable : `rankPlaces` (vérification à jour d'abord).
 */
export async function listPlacesByFamily(cityId: string, family: "decouvrir" | "trouver", limit = 6): Promise<PlaceCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PLACES_CACHE_TAG, `${PLACES_CACHE_TAG}:${cityId}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("places")
    .select(
      "id, slug, name, summary, kind, verification_status, verified_at, updated_at, category:categories!inner(name, slug, icon, family), neighborhood:neighborhoods(name)",
    )
    .eq("city_id", cityId)
    .eq("status", "published")
    .eq("category.family", family)
    .order("updated_at", { ascending: false })
    .limit(limit * 3);
  if (error) throw new Error(`Lecture des lieux impossible : ${error.message}`);

  const places = z.array(placeCardSchema).parse(data);
  const ranked = rankPlaces(
    places.map((place) => ({ ...place, verificationStatus: place.verification_status, verifiedAt: place.verified_at, updatedAt: place.updated_at })),
    new Date(),
  );
  return ranked.slice(0, limit);
}
