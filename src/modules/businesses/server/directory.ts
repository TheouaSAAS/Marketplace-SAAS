import "server-only";
import { connection } from "next/server";
import { logger } from "@/lib/logger";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { rawQueryString } from "@/modules/search/domain/params";
import { parseServiceFilters, serviceQuery, type ServiceFilters } from "@/modules/services/domain/params";
import { searchProfessionals, SERVICES_PAGE_SIZE } from "@/modules/services/server/queries";
import { getCityContext } from "@/server/city-context";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";

type Raw = Record<string, string | string[] | undefined>;

/**
 * Annuaire de tous les professionnels (artisans, commerces, agences,
 * opérateurs) : mêmes filtres et même classement que les services de
 * proximité, sur toutes les catégories ouvertes aux pages professionnelles.
 */
export async function loadDirectoryPage(raw: Raw) {
  await connection();
  const requested = parseServiceFilters(raw);
  // Ni position ni tri par distance ici : l'annuaire reste une liste.
  const filters: ServiceFilters = { ...requested, rayon: null, tri: null, dispo: false, contact: null };
  if (rawQueryString(raw) !== serviceQuery(filters)) return { kind: "redirect", query: serviceQuery(filters) } as const;
  const { current } = await getCityContext();
  if (!current.id) return { kind: "unconfigured" } as const;
  try {
    const [categories, neighborhoods] = await Promise.all([listCategories(), listNeighborhoods(current.id)]);
    const proCategories = categories.filter((category) => category.content_types.includes("business"));
    const groups = proCategories.filter((category) => !proCategories.some((parent) => parent.id === category.parent_id));
    const category = filters.metier ? proCategories.find((item) => item.slug === filters.metier) : undefined;
    const neighborhood = filters.quartier ? neighborhoods.find((item) => item.slug === filters.quartier) : undefined;
    const result = await searchProfessionals(filters, {
      cityId: current.id,
      categoryIds: category ? categoryIdsWithDescendants(categories, [category.slug]) : null,
      neighborhoodId: neighborhood?.id ?? null,
      position: null,
    });
    return {
      kind: "ok",
      filters,
      category,
      groups: groups.map((group) => ({ slug: group.slug, name: group.name, children: proCategories.filter((child) => child.parent_id === group.id).map(({ slug, name }) => ({ slug, name })) })),
      neighborhoods,
      pageSize: SERVICES_PAGE_SIZE,
      ...result,
    } as const;
  } catch (error) {
    logger.error("Annuaire des professionnels indisponible", { module: "pages-pro", error });
    return { kind: "error" } as const;
  }
}
