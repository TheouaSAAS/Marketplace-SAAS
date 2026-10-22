import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { getNeighborhoodBoundary, listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { rawQueryString } from "@/modules/search/domain/params";
import { parsePositionCookie, POSITION_COOKIE } from "@/modules/search/domain/position";
import { verificationStatusSchema } from "@/modules/shared/server/schemas";
import { getCityContext } from "@/server/city-context";
import { isFeatureEnabled } from "@/server/features";
import { ALL_LAYERS, type MapFeature } from "../domain/layers";
import { mapQuery, parseMapFilters } from "../domain/params";

/** Au plus 300 éléments par requête : au-delà, la personne zoome ou filtre. */
export const MAP_LIMIT = 300;

const featureSchema = z.object({
  layer: z.enum(ALL_LAYERS as [MapFeature["layer"], ...MapFeature["layer"][]]),
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  category: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  location_precision: z.string(),
  lat: z.number(),
  lng: z.number(),
  neighborhood: z.string().nullable(),
  starts_at: z.string().nullable(),
  total_count: z.number(),
});

type Raw = Record<string, string | string[] | undefined>;

export async function loadMapPage(raw: Raw) {
  await connection();
  const filters = parseMapFilters(raw);
  if (rawQueryString(raw) !== mapQuery(filters)) return { kind: "redirect", query: mapQuery(filters) } as const;

  const [{ current }, cookieStore] = await Promise.all([getCityContext(), cookies()]);
  if (!current.id) return { kind: "unconfigured" } as const;
  const supabase = createPublicSupabaseClient();
  if (!supabase) return { kind: "unconfigured" } as const;
  const position = isFeatureEnabled("geolocation") ? parsePositionCookie(cookieStore.get(POSITION_COOKIE)?.value) : null;

  try {
    const neighborhoods = await listNeighborhoods(current.id);
    const neighborhood = filters.quartier ? neighborhoods.find((item) => item.slug === filters.quartier) : undefined;
    const [features, boundary] = await Promise.all([
      filters.couches.length === 0
        ? Promise.resolve([])
        : supabase
            .rpc("map_features", {
              p_city: current.id,
              p_layers: filters.couches,
              p_west: filters.zone?.west,
              p_south: filters.zone?.south,
              p_east: filters.zone?.east,
              p_north: filters.zone?.north,
              p_neighborhood: neighborhood?.id,
              p_limit: MAP_LIMIT,
            })
            .then(({ data, error }) => {
              if (error) throw new Error(`Lecture de la carte impossible : ${error.message}`);
              return z.array(featureSchema).parse(data);
            }),
      neighborhood ? getNeighborhoodBoundary(neighborhood.id) : Promise.resolve(null),
    ]);
    const total = features[0]?.total_count ?? 0;
    return {
      kind: "ok",
      filters,
      neighborhoods,
      neighborhood,
      boundary,
      position,
      total,
      features: features satisfies MapFeature[],
    } as const;
  } catch (error) {
    logger.error("Carte indisponible", { module: "carte", error });
    return { kind: "error" } as const;
  }
}
