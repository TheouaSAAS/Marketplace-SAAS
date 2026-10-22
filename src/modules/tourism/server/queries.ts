import "server-only";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { listPlacesByIds, type PlaceCardData } from "@/modules/places/server/queries";
import { verificationStatusSchema } from "@/modules/shared/server/schemas";
import type { ItineraryCandidate } from "../domain/itinerary";
import type { TourismFilters } from "../domain/params";

export const TOURISM_PAGE_SIZE = 12;

const rowsSchema = z.array(z.object({ id: z.uuid(), distance_m: z.number().nullable(), total_count: z.number() }));

export type TourismCard = PlaceCardData & { distanceM: number | null };

export async function searchTourism(
  filters: TourismFilters,
  context: { cityId: string; categoryIds: string[]; position: { lat: number; lng: number } | null },
): Promise<{ total: number; items: TourismCard[] }> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) throw new Error("Tourisme indisponible : base de données non configurée.");
  const { data, error } = await supabase.rpc("search_tourism", {
    p_city: context.cityId,
    p_categories: context.categoryIds,
    p_query: filters.q || undefined,
    p_themes: filters.themes.length ? filters.themes : undefined,
    p_audiences: filters.public.length ? filters.public : undefined,
    p_max_duration: filters.duree ?? undefined,
    p_budget_max: filters.budget ?? undefined,
    p_accessibility: filters.acces.length ? filters.acces : undefined,
    p_verified_only: filters.verifie,
    p_lat: context.position?.lat,
    p_lng: context.position?.lng,
    p_radius_m: context.position && filters.rayon ? filters.rayon * 1000 : undefined,
    p_sort: context.position && filters.tri === "proximite" ? "proximite" : "pertinence",
    p_limit: TOURISM_PAGE_SIZE,
    p_offset: (filters.page - 1) * TOURISM_PAGE_SIZE,
  });
  if (error) throw new Error(`Recherche touristique impossible : ${error.message}`);
  const rows = rowsSchema.parse(data);
  const distances = new Map(rows.map((row) => [row.id, row.distance_m]));
  const cards = await listPlacesByIds(rows.map((row) => row.id));
  return { total: rows[0]?.total_count ?? 0, items: cards.map((card) => ({ ...card, distanceM: distances.get(card.id) ?? null })) };
}

const candidateSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  category_slug: z.string(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  themes: z.array(z.string()),
  audiences: z.array(z.string()),
  visit_duration: z.string().nullable(),
  price_level: z.number().nullable(),
  accessibility: z.array(z.string()),
  warnings: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

/** Lieux publiés et visibles des catégories touristiques : seule matière de l'itinéraire. */
export async function listItineraryCandidates(cityId: string, categoryIds: string[]): Promise<ItineraryCandidate[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("itinerary_candidates", { p_city: cityId, p_categories: categoryIds });
  if (error) throw new Error(`Lecture des lieux impossible : ${error.message}`);
  return z.array(candidateSchema).parse(data);
}
