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
import { interpretNeed } from "../domain/need";
import { EMPTY_SERVICE_FILTERS, parseServiceFilters, serviceQuery, type ServiceFilters } from "../domain/params";
import { searchProfessionals, serviceTradeTree, SERVICES_PAGE_SIZE } from "./queries";

type Raw = Record<string, string | string[] | undefined>;

export async function loadServicesPage(raw: Raw) {
  await connection();
  const requested = parseServiceFilters(raw);
  if (rawQueryString(raw) !== serviceQuery(requested)) return { kind: "redirect", query: serviceQuery(requested) } as const;

  const [{ current }, cookieStore] = await Promise.all([getCityContext(), cookies()]);
  if (!current.id) return { kind: "unconfigured" } as const;
  const [categories, neighborhoods] = await Promise.all([listCategories(), listNeighborhoods(current.id)]);
  const tree = serviceTradeTree(categories);
  const trades = tree.flatMap(({ group, trades: list }) => [group, ...list]);

  // Texte seul : le besoin exprimé est rapproché d'un métier par ses mots-clés.
  const textOnly = Boolean(requested.q) && serviceQuery({ ...EMPTY_SERVICE_FILTERS, q: requested.q }) === serviceQuery(requested);
  const need = textOnly ? interpretNeed(requested.q, trades) : null;
  const filters: ServiceFilters = need?.trade ? { ...requested, metier: need.trade.slug, q: "" } : requested;

  const trade = filters.metier ? categories.find((item) => item.slug === filters.metier) : undefined;
  const neighborhood = filters.quartier ? neighborhoods.find((item) => item.slug === filters.quartier) : undefined;
  const position = isFeatureEnabled("geolocation") ? parsePositionCookie(cookieStore.get(POSITION_COOKIE)?.value) : null;
  try {
    const result = await searchProfessionals(filters, {
      cityId: current.id,
      categoryIds: trade ? categoryIdsWithDescendants(categories, [trade.slug]) : null,
      neighborhoodId: neighborhood?.id ?? null,
      position,
    });
    return { kind: "ok", filters, need, tree, trade, neighborhoods, position, pageSize: SERVICES_PAGE_SIZE, ...result } as const;
  } catch (error) {
    logger.error("Recherche de professionnels impossible", { module: "services", error });
    return { kind: "error" } as const;
  }
}
