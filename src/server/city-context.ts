import "server-only";
import { cookies } from "next/headers";
import { CITY_COOKIE, LAUNCH_CITY, resolveCity, type CitySummary } from "@/domain/city";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { listActiveCities } from "./repositories/cities";

export type CitySource = "database" | "not_configured" | "unavailable";

export interface CityContext {
  cities: CitySummary[];
  current: CitySummary;
  /** D'où vient la liste : permet d'afficher un état dégradé honnête. */
  source: CitySource;
}

export function getFallbackCity(): CitySummary {
  const slug = publicEnv.NEXT_PUBLIC_DEFAULT_CITY_SLUG;
  return { id: null, slug, name: slug === LAUNCH_CITY.slug ? LAUNCH_CITY.name : slug };
}

/** Villes disponibles, sans dépendre de la requête (utilisable dans du contenu mis en cache). */
export async function loadCities(): Promise<{ cities: CitySummary[]; source: CitySource }> {
  try {
    const cities = await listActiveCities();
    if (cities === null) return { cities: [getFallbackCity()], source: "not_configured" };
    if (cities.length === 0) return { cities: [getFallbackCity()], source: "unavailable" };
    return { cities, source: "database" };
  } catch (error) {
    logger.warn("Villes indisponibles, repli sur la ville par défaut", { module: "villes", error });
    return { cities: [getFallbackCity()], source: "unavailable" };
  }
}

/**
 * Ville active de la requête (cookie `cdp_ville`, sinon ville par défaut).
 * Lit les cookies : appeler depuis un composant placé derrière un <Suspense>.
 */
export async function getCityContext(): Promise<CityContext> {
  const [{ cities, source }, cookieStore] = await Promise.all([loadCities(), cookies()]);
  const current = resolveCity(cities, cookieStore.get(CITY_COOKIE)?.value, getFallbackCity());
  return { cities, current, source };
}
