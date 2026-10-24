import "server-only";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { LISTING_CARD_COLUMNS, listingCardSchema } from "@/modules/listings/server/queries";
import { orderByIds } from "@/modules/shared/server/by-ids";
import { CONFIRMATION_DAYS } from "../domain/freshness";
import type { RealEstateFilters } from "../domain/filters";
import { REAL_ESTATE_MODES, type RealEstateMode } from "../domain/modes";

export const PAGE_SIZE = 12;

const realEstateCardSchema = listingCardSchema.extend({ attributes: z.record(z.string(), z.unknown()) });
export type RealEstateCardData = z.infer<typeof realEstateCardSchema>;

/** Cartes immobilières (colonnes publiques + attributs déclarés), dans l'ordre donné. Lues en direct, comme les résultats d'annonces (temps réel). */
export async function listRealEstateCards(ids: readonly string[]): Promise<RealEstateCardData[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("listings")
    .select(`${LISTING_CARD_COLUMNS}, attributes`)
    .eq("status", "published")
    .in("id", [...ids]);
  if (error) throw new Error(`Lecture des annonces immobilières impossible : ${error.message}`);
  return orderByIds(z.array(realEstateCardSchema).parse(data), ids);
}

const rowsSchema = z.array(z.object({ id: z.uuid(), total_count: z.number() }));

/** Une page de résultats immobiliers pour une entrée (location, vente…) et des filtres. */
export async function searchRealEstate(
  mode: RealEstateMode,
  filters: RealEstateFilters,
  context: { cityId: string; categoryIds: string[]; neighborhoodId: string | null },
): Promise<{ total: number; items: RealEstateCardData[] }> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) throw new Error("Recherche immobilière indisponible : base de données non configurée.");
  const stay = mode === "temporaire" ? "short" : mode === "location" ? "long" : undefined;
  const { data, error } = await supabase.rpc("search_real_estate", {
    p_city: context.cityId,
    p_categories: context.categoryIds,
    p_stay: stay,
    p_query: filters.q || undefined,
    p_type_bien: filters.typeBien ?? undefined,
    p_pieces_min: filters.piecesMin ?? undefined,
    p_chambres_min: filters.chambresMin ?? undefined,
    p_surface_min: filters.surfaceMin ?? undefined,
    p_meuble: filters.meuble ?? undefined,
    p_prix_min: filters.prixMin ?? undefined,
    p_prix_max: filters.prixMax ?? undefined,
    p_dispo: filters.dispo,
    p_confirmed_days: filters.confirmee ? CONFIRMATION_DAYS : undefined,
    p_neighborhood: context.neighborhoodId ?? undefined,
    p_equipements: filters.equipements.length ? filters.equipements : undefined,
    p_sort: filters.tri ?? "recent",
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`Recherche immobilière impossible : ${error.message}`);
  const rows = rowsSchema.parse(data);
  return { total: rows[0]?.total_count ?? 0, items: await listRealEstateCards(rows.map((row) => row.id)) };
}

export function modeCategorySlugs(mode: RealEstateMode): readonly string[] {
  return REAL_ESTATE_MODES[mode].categories;
}

/** Biens à comparer (3 au plus), par leur adresse ; une annonce devenue invisible est ignorée. */
export async function listRealEstateBySlugs(slugs: readonly string[]): Promise<RealEstateCardData[]> {
  const supabase = createPublicSupabaseClient();
  const wanted = [...new Set(slugs)].filter((slug) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)).slice(0, 3);
  if (!supabase || wanted.length === 0) return [];
  const { data, error } = await supabase
    .from("listings")
    .select(`${LISTING_CARD_COLUMNS}, attributes`)
    .eq("status", "published")
    .in("slug", wanted);
  if (error) throw new Error(`Lecture des biens à comparer impossible : ${error.message}`);
  const cards = z.array(realEstateCardSchema).parse(data);
  return wanted.flatMap((slug) => cards.filter((card) => card.slug === slug));
}
