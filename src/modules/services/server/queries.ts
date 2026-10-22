import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { BUSINESSES_CACHE_TAG, listBusinessesByIds, type BusinessCardData } from "@/modules/businesses/server/queries";
import { single, verificationStatusSchema } from "@/modules/shared/server/schemas";
import type { Category } from "@/server/repositories/categories";
import { AVAILABLE_DAYS, type ServiceFilters } from "../domain/params";

export const SERVICES_PAGE_SIZE = 12;


/**
 * Métiers groupés, dans l'ordre du référentiel (administrable) : les
 * sous-catégories des services professionnels, puis « Transport et
 * livraison », chacune avec ses métiers.
 */
export function serviceTradeTree(categories: Category[]): { group: Category; trades: Category[] }[] {
  const children = (parentId: string) => categories.filter((category) => category.parent_id === parentId);
  const services = categories.find((category) => category.slug === "services-professionnels");
  const transport = categories.find((category) => category.slug === "transport-livraison");
  const groups = [...(services ? children(services.id) : []), ...(transport ? [transport] : [])];
  return groups.map((group) => ({ group, trades: children(group.id) }));
}

const rowsSchema = z.array(z.object({ id: z.uuid(), distance_m: z.number().nullable(), total_count: z.number() }));

export async function searchProfessionals(
  filters: ServiceFilters,
  context: { cityId: string; categoryIds: string[] | null; neighborhoodId: string | null; position: { lat: number; lng: number } | null },
): Promise<{ total: number; items: (BusinessCardData & { distanceM: number | null })[] }> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) throw new Error("Annuaire indisponible : base de données non configurée.");
  const { data, error } = await supabase.rpc("search_professionals", {
    p_city: context.cityId,
    p_categories: context.categoryIds ?? undefined,
    p_query: filters.q || undefined,
    p_neighborhood: context.neighborhoodId ?? undefined,
    p_verified_only: filters.verifie,
    p_available_days: filters.dispo ? AVAILABLE_DAYS : undefined,
    p_contact: filters.contact ?? undefined,
    p_lat: context.position?.lat,
    p_lng: context.position?.lng,
    p_radius_m: context.position && filters.rayon ? filters.rayon * 1000 : undefined,
    p_sort: context.position && filters.tri === "proximite" ? "proximite" : "pertinence",
    p_limit: SERVICES_PAGE_SIZE,
    p_offset: (filters.page - 1) * SERVICES_PAGE_SIZE,
  });
  if (error) throw new Error(`Recherche de professionnels impossible : ${error.message}`);
  const rows = rowsSchema.parse(data);
  const distances = new Map(rows.map((row) => [row.id, row.distance_m]));
  const cards = await listBusinessesByIds(rows.map((row) => row.id));
  return { total: rows[0]?.total_count ?? 0, items: cards.map((card) => ({ ...card, distanceM: distances.get(card.id) ?? null })) };
}

const businessDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  opening_hours: z.unknown().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  updated_at: z.string(),
  owner_id: z.uuid(),
  services: z.array(z.string()),
  service_area: z.string().nullable(),
  accepts_quotes: z.boolean(),
  availability_note: z.string().nullable(),
  availability_declared_at: z.string().nullable(),
  public_location_precision: z.enum(["exact", "approximate", "neighborhood", "hidden"]),
  category: single(z.object({ name: z.string(), slug: z.string(), icon: z.string().nullable() }).nullable()),
  neighborhood: single(z.object({ name: z.string() }).nullable()),
  city: single(z.object({ name: z.string() })),
});

export type BusinessDetail = z.infer<typeof businessDetailSchema>;

/** Fiche professionnelle publique (colonnes publiques : jamais l'adresse ni la position exacte). */
export async function getPublicBusiness(slug: string): Promise<BusinessDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(BUSINESSES_CACHE_TAG, `${BUSINESSES_CACHE_TAG}:${slug}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, slug, name, description, phone, whatsapp, email, website, opening_hours, verification_status, verified_at, updated_at, owner_id, services, service_area, accepts_quotes, availability_note, availability_declared_at, public_location_precision, category:categories(name, slug, icon), neighborhood:neighborhoods(name), city:cities(name)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Lecture du professionnel impossible : ${error.message}`);
  return data ? businessDetailSchema.parse(data) : null;
}

const pointSchema = z.array(z.object({ lat: z.number(), lng: z.number() }));

export async function getBusinessPoint(businessId: string): Promise<{ lat: number; lng: number } | null> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("business_public_point", { p_business: businessId });
  if (error) throw new Error(`Lecture de la position impossible : ${error.message}`);
  return pointSchema.parse(data)[0] ?? null;
}
