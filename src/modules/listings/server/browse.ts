import "server-only";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { JOB_SCHEMAS } from "@/modules/publishing/server/queries";
import { getSessionUser } from "@/server/auth";
import { categoryIdsWithDescendants, categoryPath, listCategories, type Category } from "@/server/repositories/categories";
import { listActiveCities } from "@/server/repositories/cities";
import { categoryFilters } from "../domain/attributes";
import { appliedAttributes, attributeCriteria, browseQuery, BROWSE_PAGE_SIZE, parseBrowseParams, type BrowseParams } from "../domain/browse";
import { listListingsByIds, type ListingCardData } from "./queries";

type Raw = Record<string, string | string[] | undefined>;

/** Catégories d'annonces (hors emploi, publié dans sa propre rubrique). */
function listingCategories(all: Category[]): Category[] {
  return all.filter((category) => category.content_types.includes("listing") && !JOB_SCHEMAS.includes(category.attribute_schema ?? ""));
}

/** Schéma qui s'applique à une catégorie : le sien, sinon celui de son plus proche parent. */
function effectiveSchema(all: Category[], category: Category): { schema: string | null; fields: string[] | null } {
  for (const item of categoryPath(all, category.id).reverse()) {
    if (item.attribute_schema) return { schema: item.attribute_schema, fields: item.attribute_fields };
  }
  return { schema: null, fields: null };
}

export async function loadBrowsePage(raw: Raw) {
  const requested = parseBrowseParams(raw);
  let all: Category[];
  let cities: Awaited<ReturnType<typeof listActiveCities>>;
  try {
    [all, cities] = await Promise.all([listCategories(), listActiveCities()]);
  } catch (error) {
    logger.error("Annonces indisponibles", { module: "annonces", error });
    return { kind: "error" } as const;
  }
  if (!cities || cities.length === 0) return { kind: "unconfigured" } as const;

  const categories = listingCategories(all);
  const category = requested.categorie ? categories.find((item) => item.slug === requested.categorie) : undefined;
  // Une seule ville ouverte : elle s'applique d'office (filtre ville proposé dès la deuxième).
  const city = requested.ville ? cities.find((item) => item.slug === requested.ville) : cities.length === 1 ? cities[0] : undefined;
  const neighborhoods = city?.id ? await listNeighborhoods(city.id).catch(() => []) : [];
  const neighborhood = requested.quartier ? neighborhoods.find((item) => item.slug === requested.quartier) : undefined;
  const { schema, fields } = category ? effectiveSchema(all, category) : { schema: null, fields: null };
  const filters = categoryFilters(schema, fields);
  const criteria = attributeCriteria(requested.attributes, filters);

  const params: BrowseParams = {
    ...requested,
    categorie: category?.slug ?? null,
    ville: cities.length > 1 && city ? city.slug : null,
    quartier: neighborhood?.slug ?? null,
    attributes: appliedAttributes(criteria),
  };
  // Une seule adresse par recherche : paramètres inconnus ou invalides retirés.
  const canonical = browseQuery(params);
  if (canonical !== browseQuery(requested)) return { kind: "redirect", query: canonical } as const;

  const supabase = createPublicSupabaseClient();
  if (!supabase) return { kind: "unconfigured" } as const;
  const { data, error } = await supabase.rpc("search_listings", {
    p_city: city?.id ?? undefined,
    p_query: params.q || undefined,
    p_categories: category ? categoryIdsWithDescendants(all, [category.slug]) : undefined,
    p_neighborhood: neighborhood?.id,
    p_price_min: params.prixMin ?? undefined,
    p_price_max: params.prixMax ?? undefined,
    p_available_only: params.dispo,
    p_eq: criteria.eq ?? undefined,
    p_text: criteria.text ?? undefined,
    p_min: criteria.min ?? undefined,
    p_max: criteria.max ?? undefined,
    p_sort: params.tri ?? (params.q ? "pertinence" : "recent"),
    p_limit: BROWSE_PAGE_SIZE,
    p_offset: (params.page - 1) * BROWSE_PAGE_SIZE,
  });
  if (error) {
    logger.error("Recherche d'annonces impossible", { module: "annonces", code: error.code });
    return { kind: "error" } as const;
  }
  const rows = z.array(z.object({ id: z.uuid(), total_count: z.number() })).parse(data);
  let items: ListingCardData[];
  try {
    items = await listListingsByIds(rows.map((row) => row.id));
  } catch (error) {
    logger.error("Cartes d'annonces indisponibles", { module: "annonces", error });
    return { kind: "error" } as const;
  }

  const path = category ? categoryPath(categories, category.id) : [];
  const parentId = category?.id ?? null;
  return {
    kind: "ok",
    params,
    total: rows[0]?.total_count ?? 0,
    items,
    favoriteIds: await favoriteIds(items.map((item) => item.id)),
    category: category ?? null,
    path,
    roots: categories.filter((item) => !item.parent_id),
    children: categories.filter((item) => item.parent_id === parentId && parentId !== null),
    allCategories: categories,
    cities: cities.length > 1 ? cities : [],
    cityName: city?.name ?? null,
    neighborhoods,
    filters,
  } as const;
}

/** Favoris de la personne connectée parmi les annonces affichées. */
async function favoriteIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const user = await getSessionUser();
  if (!user) return new Set();
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return new Set();
  const { data } = await supabase.from("favorites").select("listing_id").eq("user_id", user.id).in("listing_id", ids);
  return new Set((data ?? []).map((row) => row.listing_id).filter((id): id is string => Boolean(id)));
}
