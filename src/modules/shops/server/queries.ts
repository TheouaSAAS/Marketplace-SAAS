import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { publicMediaUrl } from "@/lib/storage";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { listPlacesByIds, PLACES_CACHE_TAG, type PlaceCardData } from "@/modules/places/server/queries";
import { single, verificationStatusSchema } from "@/modules/shared/server/schemas";
import type { Category } from "@/server/repositories/categories";
import type { ShopFilters } from "../domain/params";

export const SHOPS_PAGE_SIZE = 12;

/** Racines des vues « commerces » : restaurants, puis chaque sous-catégorie des commerces (administrables). */
const RESTAURANTS = "restaurants-gastronomie";
const SHOPS = "commerces-boutiques";

/**
 * Vues spécialisées, dans l'ordre du référentiel : une sous-catégorie ajoutée
 * aux « Commerces et boutiques » depuis l'administration devient une vue.
 */
export function shopViews(categories: Category[]): Category[] {
  const restaurants = categories.find((category) => category.slug === RESTAURANTS);
  const shops = categories.find((category) => category.slug === SHOPS);
  const children = shops ? categories.filter((category) => category.parent_id === shops.id) : [];
  return [...(restaurants ? [restaurants] : []), ...children];
}

/** Catégories couvertes par l'annuaire (toutes vues confondues). */
export function shopRootSlugs(): string[] {
  return [RESTAURANTS, SHOPS];
}

const rowsSchema = z.array(z.object({ id: z.uuid(), distance_m: z.number().nullable(), total_count: z.number() }));

export type ShopCard = PlaceCardData & { distanceM: number | null };

export async function searchShops(
  filters: ShopFilters,
  context: { cityId: string; categoryIds: string[]; neighborhoodId: string | null; position: { lat: number; lng: number } | null },
): Promise<{ total: number; items: ShopCard[] }> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) throw new Error("Annuaire indisponible : base de données non configurée.");
  const { data, error } = await supabase.rpc("search_shops", {
    p_city: context.cityId,
    p_categories: context.categoryIds,
    p_query: filters.q || undefined,
    p_neighborhood: context.neighborhoodId ?? undefined,
    p_budget_max: filters.budget ?? undefined,
    p_ambiance: filters.ambiance.length ? filters.ambiance : undefined,
    p_features: filters.services.length ? filters.services : undefined,
    p_verified_only: filters.verifie,
    p_lat: context.position?.lat,
    p_lng: context.position?.lng,
    p_radius_m: context.position && filters.rayon ? filters.rayon * 1000 : undefined,
    p_sort: context.position && filters.tri === "proximite" ? "proximite" : "pertinence",
    p_limit: SHOPS_PAGE_SIZE,
    p_offset: (filters.page - 1) * SHOPS_PAGE_SIZE,
  });
  if (error) throw new Error(`Recherche de commerces impossible : ${error.message}`);
  const rows = rowsSchema.parse(data);
  const distances = new Map(rows.map((row) => [row.id, row.distance_m]));
  const cards = await listPlacesByIds(rows.map((row) => row.id));
  return { total: rows[0]?.total_count ?? 0, items: cards.map((card) => ({ ...card, distanceM: distances.get(card.id) ?? null })) };
}

/** Vitrines sponsorisées en cours (campagne active et dans ses dates), affichées à part. */
export async function sponsoredShops(cityId: string, categoryIds: string[]): Promise<PlaceCardData[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("sponsored_shops", { p_city: cityId, p_categories: categoryIds, p_limit: 2 });
  if (error) throw new Error(`Lecture des vitrines sponsorisées impossible : ${error.message}`);
  return listPlacesByIds(z.array(z.object({ id: z.uuid() })).parse(data).map((row) => row.id));
}

const placeDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  kind: z.enum(["etablissement", "lieu_touristique"]),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  updated_at: z.string(),
  price_level: z.number().nullable(),
  features: z.array(z.string()),
  ambiance: z.array(z.string()),
  products: z.array(z.string()),
  themes: z.array(z.string()),
  audiences: z.array(z.string()),
  visit_duration: z.string().nullable(),
  accessibility: z.array(z.string()),
  access_conditions: z.string().nullable(),
  warnings: z.string().nullable(),
  opening_hours: z.unknown().nullable(),
  opening_hours_verified_at: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  address_text: z.string().nullable(),
  manager_id: z.uuid().nullable(),
  location_precision: z.enum(["exact", "approximate", "unknown"]),
  hours_source: single(z.object({ title: z.string() }).nullable()),
  source: single(z.object({ title: z.string() }).nullable()),
  category: single(z.object({ name: z.string(), slug: z.string(), parent_id: z.uuid().nullable(), family: z.string() })),
  neighborhood: single(z.object({ name: z.string(), slug: z.string() }).nullable()),
  city: single(z.object({ name: z.string() })),
});

export type PlaceDetail = z.infer<typeof placeDetailSchema>;

const PLACE_DETAIL_COLUMNS =
  "id, slug, name, kind, summary, description, verification_status, verified_at, updated_at, price_level, features, ambiance, products, themes, audiences, visit_duration, accessibility, access_conditions, warnings, opening_hours, opening_hours_verified_at, phone, whatsapp, email, website, address_text, manager_id, location_precision, hours_source:sources!places_opening_hours_source_id_fkey(title), source:sources!places_source_id_fkey(title), category:categories(name, slug, parent_id, family), neighborhood:neighborhoods(name, slug), city:cities(name)";

/** Vitrine publique (lieu publié et visible) ; null sinon. */
export async function getPublicPlace(slug: string): Promise<PlaceDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PLACES_CACHE_TAG, `${PLACES_CACHE_TAG}:lieu:${slug}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("places").select(PLACE_DETAIL_COLUMNS).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error(`Lecture de la vitrine impossible : ${error.message}`);
  return data ? placeDetailSchema.parse(data) : null;
}

const pointSchema = z.array(z.object({ lat: z.number(), lng: z.number(), location_precision: z.enum(["exact", "approximate", "unknown"]) }));

export async function getPlacePoint(placeId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(PLACES_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("place_point", { p_place: placeId });
  if (error) throw new Error(`Lecture de la position impossible : ${error.message}`);
  return pointSchema.parse(data)[0] ?? null;
}

const imageSchema = z.object({ id: z.uuid(), storage_path: z.string(), alt_text: z.string().nullable() });

/** Galerie : seulement des photos réellement déposées (aucune image d'illustration inventée). */
export async function getPlaceImages(placeId: string): Promise<{ id: string; url: string; alt: string }[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PLACES_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("images").select("id, storage_path, alt_text").eq("place_id", placeId).order("sort_order").limit(12);
  if (error) throw new Error(`Lecture des photos impossible : ${error.message}`);
  return z
    .array(imageSchema)
    .parse(data)
    .flatMap((image) => {
      const url = publicMediaUrl(image.storage_path);
      return url ? [{ id: image.id, url, alt: image.alt_text ?? "" }] : [];
    });
}

const engagementSchema = z.array(z.object({ likes: z.number(), liked: z.boolean(), favorite: z.boolean() }));

/** Total des « j'aime » et état personnel (favori, j'aime) de la personne connectée. */
export async function getPlaceEngagement(placeId: string): Promise<{ likes: number; liked: boolean; favorite: boolean }> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { likes: 0, liked: false, favorite: false };
  const { data, error } = await supabase.rpc("place_engagement", { p_place: placeId });
  if (error) throw new Error(`Lecture de l’engagement impossible : ${error.message}`);
  return engagementSchema.parse(data)[0] ?? { likes: 0, liked: false, favorite: false };
}

/** Revendication en cours de la personne connectée pour cette vitrine. */
export async function getMyPendingClaim(placeId: string, userId: string): Promise<{ created_at: string } | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("place_claims")
    .select("created_at")
    .eq("place_id", placeId)
    .eq("claimant_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  return data;
}
