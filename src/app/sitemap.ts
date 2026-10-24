import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { ROUTES, type AppRoute } from "@/config/routes";
import { contentSitemapEntries } from "@/server/sitemap-entries";

/**
 * Pages publiques terminées (jamais les pages privées ni les rubriques en
 * préparation), puis les fiches publiées et indexables (annonces, lieux,
 * événements à venir, professionnels, articles du guide, quartiers).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = Object.values(ROUTES as Record<string, AppRoute>)
    .filter((route) => route.status === "live" && !route.private && !route.path.includes("["))
    .map((route) => ({
      url: `${SITE.url}${route.path === "/" ? "" : route.path}`,
      changeFrequency: route.path === "/" ? "daily" : "weekly",
      priority: route.path === "/" ? 1 : 0.7,
    }));
  return [...pages, ...(await contentSitemapEntries())];
}
