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
  section: single(z.object({ name: z.string(), icon: z.string().nullable() }).nullable()),
});

export type GuideCardData = z.infer<typeof guideCardSchema>;

/** Articles du guide publiés par identifiants, dans l'ordre donné (résultats de recherche). */
export async function listGuideArticlesByIds(ids: readonly string[]): Promise<GuideCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(GUIDE_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("guide_articles")
    .select("id, slug, title, summary, verification_status, verified_at, published_at, updated_at, section:guide_sections(name, icon)")
    .eq("status", "published")
    .in("id", [...ids]);
  if (error) throw new Error(`Lecture du guide impossible : ${error.message}`);
  return orderByIds(z.array(guideCardSchema).parse(data), ids);
}
