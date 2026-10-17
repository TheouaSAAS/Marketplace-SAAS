import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { ROUTES, type AppRoute } from "@/config/routes";

/**
 * Pages statiques publiques et validées. Les pages de détail (annonces, lieux,
 * événements) et les pages de ville seront ajoutées depuis la base en phase 2.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(ROUTES as Record<string, AppRoute>)
    .filter((route) => route.status === "live" && !route.private && !route.path.includes("["))
    .map((route) => ({
      url: `${SITE.url}${route.path === "/" ? "" : route.path}`,
      changeFrequency: route.path === "/" ? "daily" : "weekly",
      priority: route.path === "/" ? 1 : 0.7,
    }));
}
