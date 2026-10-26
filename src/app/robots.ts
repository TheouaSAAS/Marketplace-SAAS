import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { ROUTES } from "@/config/routes";
import { isIndexableEnvironment, resolveAppEnvironment } from "@/config/environment";

/**
 * Espaces privés interdits aux robots. Un segment dynamique (« /publier/[id] »)
 * devient un préfixe (« /publier/ ») : la syntaxe [id] n'existe pas dans robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  // Préproduction et développement : rien n'est indexable (en plus de l'en-tête X-Robots-Tag).
  if (!isIndexableEnvironment(resolveAppEnvironment())) return { rules: [{ userAgent: "*", disallow: "/" }] };

  const disallow = [
    ...new Set(
      Object.values(ROUTES)
        .filter((route) => "private" in route && route.private)
        .map((route) => route.path.replace(/\[[^\]]+\].*$/, "")),
    ),
    "/api/",
    "/interne",
  ].sort();

  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
