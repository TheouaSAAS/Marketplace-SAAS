import "server-only";
import { connection } from "next/server";
import { logger } from "@/lib/logger";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { rawQueryString } from "@/modules/search/domain/params";
import { getCityContext } from "@/server/city-context";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { EMPTY_FILTERS, parseRealEstateFilters, realEstateQuery, type RealEstateFilters } from "../domain/filters";
import { REAL_ESTATE_MODES, type RealEstateMode } from "../domain/modes";
import { interpretRealEstate } from "../domain/natural-language";
import { PAGE_SIZE, searchRealEstate } from "./queries";

type Raw = Record<string, string | string[] | undefined>;

/** Seul le texte est renseigné : une phrase à interpréter (saisie libre). */
function onlyText(filters: RealEstateFilters): boolean {
  return Boolean(filters.q) && realEstateQuery({ ...EMPTY_FILTERS, q: filters.q }) === realEstateQuery(filters);
}

export async function loadRealEstatePage(mode: RealEstateMode, raw: Raw) {
  // Données de la requête réelle uniquement (jamais pendant un prérendu ou un préchargement).
  await connection();
  const requested = parseRealEstateFilters(raw, mode);
  // Une seule adresse par recherche (champs vides du formulaire, valeurs invalides retirés).
  if (rawQueryString(raw) !== realEstateQuery(requested)) return { kind: "redirect", query: realEstateQuery(requested) } as const;

  const { current } = await getCityContext();
  if (!current.id) return { kind: "unconfigured" } as const;
  const [categories, neighborhoods] = await Promise.all([listCategories(), listNeighborhoods(current.id)]);

  const interpretation = onlyText(requested)
    ? interpretRealEstate(requested.q, mode, neighborhoods.map(({ slug, name }) => ({ slug, name })))
    : null;
  const applied = interpretation && interpretation.understood.length > 0 ? interpretation : null;
  const filters: RealEstateFilters = applied ? { ...requested, ...applied.filters, q: applied.keywords } : requested;

  const neighborhood = filters.quartier ? neighborhoods.find((item) => item.slug === filters.quartier) : undefined;
  const categoryIds = categoryIdsWithDescendants(categories, REAL_ESTATE_MODES[mode].categories);
  try {
    const { total, items } = await searchRealEstate(mode, { ...filters, quartier: neighborhood?.slug ?? null }, {
      cityId: current.id,
      categoryIds,
      neighborhoodId: neighborhood?.id ?? null,
    });
    return { kind: "ok", filters, interpretation: applied, neighborhoods, total, items, pageSize: PAGE_SIZE, cityName: current.name } as const;
  } catch (error) {
    logger.error("Recherche immobilière impossible", { module: "immobilier", error });
    return { kind: "error" } as const;
  }
}
