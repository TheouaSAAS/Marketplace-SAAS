import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { ROUTES } from "@/config/routes";

export default function robots(): MetadataRoute.Robots {
  const disallow = Object.values(ROUTES)
    .filter((route) => "private" in route && route.private)
    .map((route) => route.path);

  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
