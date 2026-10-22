import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { orderByIds } from "@/modules/shared/server/by-ids";
import { single, verificationStatusSchema } from "@/modules/shared/server/schemas";

export const GUIDE_CACHE_TAG = "guide";

const guideCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  published_at: z.string().nullable(),
  updated_at: z.string(),
  section: single(z.object({ name: z.string(), icon: z.string().nullable(), slug: z.string() }).nullable()),
});

export type GuideCardData = z.infer<typeof guideCardSchema>;

const CARD_COLUMNS = "id, slug, title, summary, verification_status, verified_at, published_at, updated_at";

/** Articles du guide publiés par identifiants, dans l'ordre donné (résultats de recherche). */
export async function listGuideArticlesByIds(ids: readonly string[]): Promise<GuideCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDE_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("guide_articles")
    .select(`${CARD_COLUMNS}, section:guide_sections(name, icon, slug)`)
    .eq("status", "published")
    .in("id", [...ids]);
  if (error) throw new Error(`Lecture du guide impossible : ${error.message}`);
  return orderByIds(z.array(guideCardSchema).parse(data), ids);
}

/** Articles publiés d'une rubrique du guide pour une ville (les plus récents d'abord). */
export async function listGuideArticlesBySection(cityId: string, sectionSlug: string, limit = 12): Promise<GuideCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDE_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("guide_articles")
    .select(`${CARD_COLUMNS}, section:guide_sections!inner(name, icon, slug)`)
    .eq("city_id", cityId)
    .eq("status", "published")
    .eq("section.slug", sectionSlug)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Lecture du guide impossible : ${error.message}`);
  return z.array(guideCardSchema).parse(data);
}

const sectionSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  category_slugs: z.array(z.string()),
});

export type GuideSection = z.infer<typeof sectionSchema>;

/** Rubriques actives, dans l'ordre du référentiel (administrable). */
export async function listGuideSections(): Promise<GuideSection[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(GUIDE_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("guide_sections")
    .select("id, slug, name, description, icon, category_slugs")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`Lecture des rubriques impossible : ${error.message}`);
  return z.array(sectionSchema).parse(data);
}

/** Nombre d'articles publiés par rubrique (sommaire du guide). */
export async function countGuideArticles(cityId: string): Promise<Map<string, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDE_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return new Map();
  const { data, error } = await supabase.from("guide_articles").select("section:guide_sections!inner(slug)").eq("city_id", cityId).eq("status", "published");
  if (error) throw new Error(`Lecture du guide impossible : ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of z.array(z.object({ section: single(z.object({ slug: z.string() })) })).parse(data)) {
    counts.set(row.section.slug, (counts.get(row.section.slug) ?? 0) + 1);
  }
  return counts;
}

const articleSchema = guideCardSchema.extend({
  body: z.string(),
  version: z.number(),
  section: single(z.object({ id: z.uuid(), name: z.string(), icon: z.string().nullable(), slug: z.string() })),
});

export type GuideArticle = z.infer<typeof articleSchema>;

/** Article publié et visible ; null sinon. */
export async function getGuideArticle(slug: string): Promise<GuideArticle | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDE_CACHE_TAG, `${GUIDE_CACHE_TAG}:${slug}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("guide_articles")
    .select(`${CARD_COLUMNS}, body, version, section:guide_sections(id, name, icon, slug)`)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Lecture de l’article impossible : ${error.message}`);
  return data ? articleSchema.parse(data) : null;
}

const creditsSchema = z.array(
  z.object({
    author_name: z.string().nullable(),
    source_title: z.string().nullable(),
    source_publisher: z.string().nullable(),
    source_url: z.string().nullable(),
    source_collected_at: z.string().nullable(),
    verifier_name: z.string().nullable(),
  }),
);
const historySchema = z.array(z.object({ version: z.number(), created_at: z.string(), change_note: z.string().nullable() }));

/** Auteur, source, vérificateur et historique public (dates et notes de version). */
export async function getArticleProvenance(articleId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDE_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return { credits: null, history: [] };
  const [credits, history] = await Promise.all([
    supabase.rpc("guide_article_credits", { p_article: articleId }),
    supabase.rpc("guide_article_history", { p_article: articleId }),
  ]);
  if (credits.error || history.error) throw new Error(`Lecture de la provenance impossible : ${(credits.error ?? history.error)!.message}`);
  return { credits: creditsSchema.parse(credits.data)[0] ?? null, history: historySchema.parse(history.data) };
}

const searchRowsSchema = z.array(z.object({ id: z.uuid(), total_count: z.number() }));

/** Recherche dans le guide (même moteur que la recherche du site, type « guide »). */
export async function searchGuide(cityId: string, query: string): Promise<{ total: number; items: GuideCardData[] }> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return { total: 0, items: [] };
  const { data, error } = await supabase.rpc("search_content", { p_type: "guide", p_city: cityId, p_query: query, p_sort: "pertinence", p_limit: 20 });
  if (error) throw new Error(`Recherche dans le guide impossible : ${error.message}`);
  const rows = searchRowsSchema.parse(data);
  return { total: rows[0]?.total_count ?? 0, items: await listGuideArticlesByIds(rows.map((row) => row.id)) };
}

/** Contenus publiés par catégorie du site (sous-catégories comprises) : un lien n'est proposé que s'il en existe. */
export async function countCategoryContents(cityId: string, slugs: string[]): Promise<Map<string, number>> {
  const supabase = createPublicSupabaseClient();
  if (!supabase || slugs.length === 0) return new Map();
  const { data, error } = await supabase.rpc("category_content_counts", { p_city: cityId, p_slugs: slugs });
  if (error) throw new Error(`Comptage des contenus impossible : ${error.message}`);
  return new Map(z.array(z.object({ slug: z.string(), total: z.number() })).parse(data).map((row) => [row.slug, row.total]));
}
