import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { single, verificationStatusSchema } from "@/modules/shared/server/schemas";

/*
 * Lectures de la rédaction du guide (équipe locale) : tous les statuts, les
 * versions et les suggestions. Les règles d'accès de la base les réservent
 * aux éditeurs locaux et aux administrateurs.
 */

const contentStatusSchema = z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]);

const listRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status: contentStatusSchema,
  verification_status: verificationStatusSchema,
  version: z.number(),
  updated_at: z.string(),
  section: single(z.object({ name: z.string(), slug: z.string() })),
  suggestions: z.array(z.object({ status: z.string() })),
});

export type EditorialRow = z.infer<typeof listRowSchema>;

export async function listArticlesForEditing(): Promise<EditorialRow[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("guide_articles")
    .select("id, slug, title, status, verification_status, version, updated_at, section:guide_sections(name, slug), suggestions:guide_suggestions(status)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Lecture de la rédaction impossible : ${error.message}`);
  return z.array(listRowSchema).parse(data);
}

const editSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  body: z.string(),
  status: contentStatusSchema,
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  source_id: z.uuid().nullable(),
  version: z.number(),
  section_id: z.uuid(),
  section: single(z.object({ slug: z.string() })),
});

const versionSchema = z.object({ version: z.number(), title: z.string(), summary: z.string().nullable(), body: z.string(), change_note: z.string().nullable(), created_at: z.string() });
const suggestionSchema = z.object({
  id: z.uuid(),
  message: z.string(),
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
  resolution_note: z.string().nullable(),
  created_at: z.string(),
});

export type EditableArticle = z.infer<typeof editSchema>;
export type ArticleVersion = z.infer<typeof versionSchema>;
export type ArticleSuggestion = z.infer<typeof suggestionSchema>;

export async function getArticleForEditing(id: string): Promise<{ article: EditableArticle; versions: ArticleVersion[]; suggestions: ArticleSuggestion[] } | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const [article, versions, suggestions] = await Promise.all([
    supabase
      .from("guide_articles")
      .select("id, slug, title, summary, body, status, verification_status, verified_at, source_id, version, section_id, section:guide_sections(slug)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("guide_article_versions").select("version, title, summary, body, change_note, created_at").eq("article_id", id).order("version", { ascending: false }).limit(50),
    supabase.from("guide_suggestions").select("id, message, status, resolution_note, created_at").eq("article_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  const error = article.error ?? versions.error ?? suggestions.error;
  if (error) throw new Error(`Lecture de l’article impossible : ${error.message}`);
  if (!article.data) return null;
  return {
    article: editSchema.parse(article.data),
    versions: z.array(versionSchema).parse(versions.data),
    suggestions: z.array(suggestionSchema).parse(suggestions.data),
  };
}

const sourceSchema = z.object({ id: z.uuid(), title: z.string(), kind: z.string(), collected_at: z.string() });

export async function listSources(): Promise<z.infer<typeof sourceSchema>[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("sources").select("id, title, kind, collected_at").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Lecture des sources impossible : ${error.message}`);
  return z.array(sourceSchema).parse(data);
}

export async function listEditorialSections(): Promise<{ id: string; name: string }[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("guide_sections").select("id, name").order("sort_order");
  if (error) throw new Error(`Lecture des rubriques impossible : ${error.message}`);
  return z.array(z.object({ id: z.uuid(), name: z.string() })).parse(data);
}
