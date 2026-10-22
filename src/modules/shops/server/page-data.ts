import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { logger } from "@/lib/logger";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { rawQueryString } from "@/modules/search/domain/params";
import { parsePositionCookie, POSITION_COOKIE } from "@/modules/search/domain/position";
import { getCityContext } from "@/server/city-context";
import { isFeatureEnabled } from "@/server/features";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { parseShopFilters, shopQuery, type ShopFilters } from "../domain/params";
import { searchShops, shopRootSlugs, SHOPS_PAGE_SIZE, shopViews, sponsoredShops } from "./queries";

type Raw = Record<string, string | string[] | undefined>;

export async function loadShopsPage(raw: Raw) {
  await connection();
  const requested = parseShopFilters(raw);
  if (rawQueryString(raw) !== shopQuery(requested)) return { kind: "redirect", query: shopQuery(requested) } as const;

  const [{ current }, cookieStore] = await Promise.all([getCityContext(), cookies()]);
  if (!current.id) return { kind: "unconfigured" } as const;
  const [categories, neighborhoods] = await Promise.all([listCategories(), listNeighborhoods(current.id)]);
  const views = shopViews(categories);
  // Une vue inconnue (désactivée, mal saisie) est ignorée plutôt que de vider la page.
  const view = views.find((item) => item.slug === requested.type);
  const filters: ShopFilters = view ? requested : { ...requested, type: null };
  const categoryIds = categoryIdsWithDescendants(categories, view ? [view.slug] : shopRootSlugs());

  const neighborhood = filters.quartier ? neighborhoods.find((item) => item.slug === filters.quartier) : undefined;
  const position = isFeatureEnabled("geolocation") ? parsePositionCookie(cookieStore.get(POSITION_COOKIE)?.value) : null;
  try {
    const [result, sponsored] = await Promise.all([
      searchShops(filters, { cityId: current.id, categoryIds, neighborhoodId: neighborhood?.id ?? null, position }),
      sponsoredShops(current.id, categoryIds).catch((error: unknown) => {
        logger.warn("Vitrines sponsorisées indisponibles", { module: "commerces", error });
        return [];
      }),
    ]);
    return { kind: "ok", filters, views, view, neighborhoods, position, sponsored, pageSize: SHOPS_PAGE_SIZE, ...result } as const;
  } catch (error) {
    logger.error("Recherche de commerces impossible", { module: "commerces", error });
    return { kind: "error" } as const;
  }
}
