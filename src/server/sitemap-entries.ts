import "server-only";
import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { href } from "@/config/routes";
import { absoluteUrl } from "@/lib/seo";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

/**
 * Fiches publiques du sitemap : seulement ce qui est publié, visible et
 * indexable. Jamais un exemple de démonstration, une annonce expirée, un
 * doublon fusionné, un événement passé ni l'annonce d'un membre qui refuse
 * l'indexation. Recalculé au plus toutes les heures.
 */
export async function contentSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const now = new Date().toISOString();
  try {
    const [listings, places, events, businesses, articles, neighborhoods, optOut] = await Promise.all([
      supabase.from("listings").select("slug, owner_id, updated_at").eq("status", "published").neq("verification_status", "placeholder").gt("expires_at", now).limit(20000),
      supabase.from("places").select("slug, updated_at").eq("status", "published").neq("verification_status", "placeholder").is("merged_into", null).limit(10000),
      supabase.from("events").select("slug, updated_at").eq("status", "published").neq("verification_status", "placeholder").neq("schedule_status", "cancelled").gt("starts_at", now).limit(5000),
      supabase.from("business_profiles").select("slug, updated_at").eq("status", "published").neq("verification_status", "placeholder").limit(10000),
      supabase.from("guide_articles").select("slug, updated_at, section:guide_sections(slug)").eq("status", "published").neq("verification_status", "placeholder").limit(2000),
      supabase.from("neighborhoods").select("slug, updated_at").eq("is_active", true).limit(500),
      // Préférence de confidentialité : lue par la clé secrète (jamais exposée).
      createAdminSupabaseClient()?.from("user_preferences").select("user_id").eq("search_indexing", false).limit(50000) ?? Promise.resolve({ data: [], error: null }),
    ]);
    const hidden = new Set((optOut.data ?? []).map((row) => row.user_id));
    const entry = (path: string, updatedAt: string, priority: number): MetadataRoute.Sitemap[number] => ({ url: absoluteUrl(path), lastModified: updatedAt, changeFrequency: "weekly", priority });
    return [
      ...(listings.data ?? []).filter((row) => !hidden.has(row.owner_id)).map((row) => entry(href("listingDetail", { params: { slug: row.slug } }), row.updated_at, 0.6)),
      ...(places.data ?? []).map((row) => entry(href("placeDetail", { params: { slug: row.slug } }), row.updated_at, 0.6)),
      ...(events.data ?? []).map((row) => entry(href("eventDetail", { params: { slug: row.slug } }), row.updated_at, 0.6)),
      ...(businesses.data ?? []).map((row) => entry(href("professionalDetail", { params: { slug: row.slug } }), row.updated_at, 0.6)),
      ...(articles.data ?? []).flatMap((row) => {
        const section = Array.isArray(row.section) ? row.section[0] : row.section;
        return section ? [entry(href("guideArticle", { params: { rubrique: section.slug, article: row.slug } }), row.updated_at, 0.7)] : [];
      }),
      ...(neighborhoods.data ?? []).map((row) => entry(href("neighborhoodDetail", { params: { slug: row.slug } }), row.updated_at, 0.5)),
    ];
  } catch (error) {
    logger.warn("Sitemap des fiches indisponible", { module: "seo", error });
    return [];
  }
}
