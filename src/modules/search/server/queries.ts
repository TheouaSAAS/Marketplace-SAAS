import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { listBusinessesByIds, type BusinessCardData } from "@/modules/businesses/server/queries";
import { listEventsByIds, type EventCardData } from "@/modules/events/server/queries";
import { listGuideArticlesByIds, type GuideCardData } from "@/modules/guide/server/queries";
import { listListingsByIds, type ListingCardData } from "@/modules/listings/server/queries";
import { listPlacesByIds, type PlaceCardData } from "@/modules/places/server/queries";
import { whenRange } from "../domain/dates";
import { SEARCH_TYPE_KEYS, type SearchParams, type SearchSort, type SearchType } from "../domain/params";
import type { Position } from "../domain/position";

/** Critères résolus (slugs traduits en identifiants) envoyés à la base. */
export interface ResolvedSearch {
  cityId: string;
  params: SearchParams;
  categoryIds: string[] | null;
  neighborhoodId: string | null;
  position: Position | null;
  now: Date;
}

export type SearchItem =
  | { type: "annonces"; data: ListingCardData; distanceM: number | null }
  | { type: "lieux"; data: PlaceCardData; distanceM: number | null }
  | { type: "professionnels"; data: BusinessCardData; distanceM: number | null }
  | { type: "evenements"; data: EventCardData; distanceM: number | null }
  | { type: "guide"; data: GuideCardData; distanceM: number | null };

const rowsSchema = z.array(z.object({ id: z.uuid(), distance_m: z.number().nullable(), total_count: z.number() }));
const countsSchema = z.array(z.object({ type: z.enum(SEARCH_TYPE_KEYS as [SearchType, ...SearchType[]]), total: z.number() }));

function commonArgs(search: ResolvedSearch) {
  const { params, position } = search;
  return {
    p_city: search.cityId,
    p_query: search.params.q || undefined,
    p_neighborhood: search.neighborhoodId ?? undefined,
    p_verified_only: params.verifie,
    p_lat: position?.lat,
    p_lng: position?.lng,
    p_radius_m: position && params.rayon ? params.rayon * 1000 : undefined,
  };
}

function client() {
  const supabase = createPublicSupabaseClient();
  if (!supabase) throw new Error("Recherche indisponible : base de données non configurée.");
  return supabase;
}

/** Nombre de résultats par type pour les critères communs (texte, quartier, vérifiés, rayon). */
export async function countByType(search: ResolvedSearch): Promise<Record<SearchType, number>> {
  const { data, error } = await client().rpc("search_counts", commonArgs(search));
  if (error) throw new Error(`Recherche impossible : ${error.message}`);
  const counts = Object.fromEntries(SEARCH_TYPE_KEYS.map((type) => [type, 0])) as Record<SearchType, number>;
  for (const row of countsSchema.parse(data)) counts[row.type] = row.total;
  return counts;
}

async function loadCards(type: SearchType, ids: string[], distances: Map<string, number | null>): Promise<SearchItem[]> {
  const distance = (id: string) => distances.get(id) ?? null;
  switch (type) {
    case "annonces":
      return (await listListingsByIds(ids)).map((data) => ({ type, data, distanceM: distance(data.id) }));
    case "lieux":
      return (await listPlacesByIds(ids)).map((data) => ({ type, data, distanceM: distance(data.id) }));
    case "professionnels":
      return (await listBusinessesByIds(ids)).map((data) => ({ type, data, distanceM: distance(data.id) }));
    case "evenements":
      return (await listEventsByIds(ids)).map((data) => ({ type, data, distanceM: distance(data.id) }));
    case "guide":
      return (await listGuideArticlesByIds(ids)).map((data) => ({ type, data, distanceM: distance(data.id) }));
  }
}

/** Une page de résultats d'un type, avec tous les filtres et le tri demandés. */
export async function searchType(
  search: ResolvedSearch,
  type: SearchType,
  { sort, limit, offset }: { sort: SearchSort; limit: number; offset: number },
): Promise<{ total: number; items: SearchItem[] }> {
  const { params } = search;
  const period = params.quand ? whenRange(params.quand, search.now) : null;
  const { data, error } = await client().rpc("search_content", {
    ...commonArgs(search),
    p_type: type,
    p_categories: search.categoryIds ?? undefined,
    p_price_min: params.prixMin ?? undefined,
    p_price_max: params.prixMax ?? undefined,
    p_available_only: params.dispo,
    p_seller: params.annonceur ?? undefined,
    p_starts_from: period?.from.toISOString(),
    p_starts_to: period?.to.toISOString(),
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(`Recherche impossible : ${error.message}`);
  const rows = rowsSchema.parse(data);
  const distances = new Map(rows.map((row) => [row.id, row.distance_m]));
  const items = await loadCards(type, rows.map((row) => row.id), distances);
  return { total: rows[0]?.total_count ?? 0, items };
}

const DEFAULT_RADII_METERS = [1000, 5000, 10000, 25000];

/** Rayons proposés (paramètre public `geo.search_radii`, modifiable depuis l'administration), en km. */
export async function getSearchRadiiKm(): Promise<number[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("platform_settings");

  const supabase = createPublicSupabaseClient();
  const fallback = DEFAULT_RADII_METERS.map((meters) => meters / 1000);
  if (!supabase) return fallback;
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "geo.search_radii").maybeSingle();
  const parsed = z.object({ meters: z.array(z.number().int().min(100).max(100_000)).min(1) }).safeParse(data?.value);
  if (!parsed.success) return fallback;
  return [...new Set(parsed.data.meters.map((meters) => Math.max(1, Math.round(meters / 1000))))].sort((a, b) => a - b);
}
