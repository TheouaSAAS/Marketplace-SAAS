import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { logger } from "@/lib/logger";
import { listUpcomingEvents } from "@/modules/events/server/queries";
import { rawQueryString } from "@/modules/search/domain/params";
import { parsePositionCookie, POSITION_COOKIE } from "@/modules/search/domain/position";
import { getCityContext } from "@/server/city-context";
import { isFeatureEnabled } from "@/server/features";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { TOURISM_CATEGORIES, TOURISM_ENTRIES, type TourismEntry } from "../domain/entries";
import { buildItinerary, itineraryQuery, parseItineraryRequest } from "../domain/itinerary";
import { parseTourismFilters, tourismQuery, type TourismFilters } from "../domain/params";
import { listItineraryCandidates, searchTourism, TOURISM_PAGE_SIZE } from "./queries";

type Raw = Record<string, string | string[] | undefined>;

/** Exploration (toutes catégories touristiques, ou une entrée « Où dormir ? »…). */
export async function loadTourismPage(raw: Raw, entry: TourismEntry | null) {
  await connection();
  const requested = parseTourismFilters(raw);
  if (rawQueryString(raw) !== tourismQuery(requested)) return { kind: "redirect", query: tourismQuery(requested) } as const;

  const [{ current }, cookieStore] = await Promise.all([getCityContext(), cookies()]);
  if (!current.id) return { kind: "unconfigured" } as const;
  const categories = await listCategories();
  const scope = entry ? [...TOURISM_ENTRIES[entry].categories] : TOURISM_CATEGORIES;
  const types = categories.filter((category) => scope.includes(category.slug));
  // Un type hors de l'entrée (ou désactivé) est ignoré plutôt que de vider la page.
  const type = types.find((item) => item.slug === requested.type);
  const filters: TourismFilters = type ? requested : { ...requested, type: null };
  const categoryIds = categoryIdsWithDescendants(categories, type ? [type.slug] : types.map((item) => item.slug));
  const position = isFeatureEnabled("geolocation") ? parsePositionCookie(cookieStore.get(POSITION_COOKIE)?.value) : null;

  try {
    const [result, events] = await Promise.all([
      searchTourism(filters, { cityId: current.id, categoryIds, position }),
      entry === "sortir"
        ? listUpcomingEvents(current.id, 6).catch((error: unknown) => {
            logger.warn("Événements indisponibles", { module: "tourisme", error });
            return [];
          })
        : Promise.resolve([]),
    ]);
    return { kind: "ok", filters, types, type, position, events, pageSize: TOURISM_PAGE_SIZE, ...result } as const;
  } catch (error) {
    logger.error("Recherche touristique impossible", { module: "tourisme", error });
    return { kind: "error" } as const;
  }
}

/** Itinéraire : demande lue dans l'adresse, composé uniquement de lieux présents en base. */
export async function loadItinerary(raw: Raw) {
  await connection();
  const request = parseItineraryRequest(raw);
  if (!request) return { kind: "form" } as const;
  const canonical = itineraryQuery(request);
  if (rawQueryString(raw) !== canonical) return { kind: "redirect", query: canonical } as const;

  const { current } = await getCityContext();
  if (!current.id) return { kind: "unconfigured" } as const;
  try {
    const categories = await listCategories();
    const candidates = await listItineraryCandidates(current.id, categoryIdsWithDescendants(categories, TOURISM_CATEGORIES));
    return { kind: "ok", request, steps: buildItinerary(candidates, request, new Date()), available: candidates.length } as const;
  } catch (error) {
    logger.error("Itinéraire impossible", { module: "tourisme", error });
    return { kind: "error" } as const;
  }
}
