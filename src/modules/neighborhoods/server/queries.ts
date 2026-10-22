import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { verificationStatusSchema } from "@/modules/shared/server/schemas";

export const NEIGHBORHOODS_CACHE_TAG = "neighborhoods";

const neighborhoodSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
});

export type NeighborhoodSummary = z.infer<typeof neighborhoodSchema>;

/** Quartiers publics d'une ville, par ordre alphabétique (aucun classement « meilleur »). */
export async function listNeighborhoods(cityId: string): Promise<NeighborhoodSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(NEIGHBORHOODS_CACHE_TAG, `${NEIGHBORHOODS_CACHE_TAG}:${cityId}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("neighborhoods")
    .select("id, slug, name, verification_status, verified_at")
    .eq("city_id", cityId)
    .order("name");
  if (error) throw new Error(`Lecture des quartiers impossible : ${error.message}`);
  return z.array(neighborhoodSchema).parse(data);
}

const detailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  alt_names: z.array(z.string()),
  description: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  boundary_validated_at: z.string().nullable(),
  updated_at: z.string(),
  source: z.object({ title: z.string() }).nullable(),
});

export type NeighborhoodDetail = z.infer<typeof detailSchema>;

/** Fiche publique d'un quartier (ville courante) ; null s'il n'existe pas ou n'est pas visible. */
export async function getNeighborhood(cityId: string, slug: string): Promise<NeighborhoodDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEIGHBORHOODS_CACHE_TAG, `${NEIGHBORHOODS_CACHE_TAG}:${cityId}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("neighborhoods")
    .select("id, slug, name, alt_names, description, verification_status, verified_at, boundary_validated_at, updated_at, source:sources(title)")
    .eq("city_id", cityId)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Lecture du quartier impossible : ${error.message}`);
  return data ? detailSchema.parse(data) : null;
}

/** Nombre de contenus publiés rattachés au quartier, par onglet. */
export async function getNeighborhoodCounts(neighborhoodId: string): Promise<Record<string, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEIGHBORHOODS_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return {};
  const { data, error } = await supabase.rpc("neighborhood_resource_counts", { p_neighborhood: neighborhoodId });
  if (error) throw new Error(`Comptage des ressources impossible : ${error.message}`);
  return Object.fromEntries(z.array(z.object({ kind: z.string(), total: z.number() })).parse(data).map((row) => [row.kind, row.total]));
}

/** Périmètre validé (GeoJSON) ; null si le quartier n'en a pas. */
export async function getNeighborhoodBoundary(neighborhoodId: string): Promise<string | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(NEIGHBORHOODS_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("neighborhood_boundary_geojson", { p_neighborhood: neighborhoodId });
  if (error) throw new Error(`Lecture du périmètre impossible : ${error.message}`);
  return typeof data === "string" ? data : null;
}

const idsSchema = z.array(z.object({ id: z.uuid() }));

/**
 * Identifiants des contenus publiés RATTACHÉS au quartier (neighborhood_id) dans
 * des catégories données, les plus récemment mis à jour d'abord.
 */
export async function listNeighborhoodContentIds(
  table: "places" | "listings" | "business_profiles",
  neighborhoodId: string,
  categoryIds: string[],
  limit = 6,
): Promise<string[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase || categoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("neighborhood_id", neighborhoodId)
    .eq("status", "published")
    .in("category_id", categoryIds)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Lecture des contenus du quartier impossible : ${error.message}`);
  return idsSchema.parse(data).map((row) => row.id);
}

/** Événements à venir rattachés au quartier. */
export async function listNeighborhoodEventIds(neighborhoodId: string, limit = 6): Promise<string[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("neighborhood_id", neighborhoodId)
    .eq("status", "published")
    .gte("starts_at", new Date(Date.now() - 86_400_000).toISOString())
    .order("starts_at")
    .limit(limit);
  if (error) throw new Error(`Lecture des événements du quartier impossible : ${error.message}`);
  return idsSchema.parse(data).map((row) => row.id);
}
