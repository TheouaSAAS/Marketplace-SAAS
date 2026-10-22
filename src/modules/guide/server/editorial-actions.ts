"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { slugify } from "@/modules/admin/domain/categories";
import { ARTICLE_STATUSES, ARTICLE_VERIFICATIONS, SOURCE_KINDS, SUGGESTION_DECISIONS } from "../domain/editorial";
import { GUIDE_CACHE_TAG } from "./queries";

const keys = <T extends Record<string, string>>(table: T) => Object.keys(table) as [keyof T & string, ...(keyof T & string)[]];

const articleSchema = z
  .object({
    id: z.uuid().optional(),
    rubrique: z.uuid({ error: "Choisissez une rubrique." }),
    slug: z.string().trim().max(80).optional(),
    titre: z.string().trim().min(5, "5 caractères au moins.").max(160, "160 caractères au maximum."),
    resume: z.string().trim().max(300, "300 caractères au maximum.").optional(),
    corps: z.string().trim().min(20, "20 caractères au moins.").max(50000, "50 000 caractères au maximum."),
    statut: z.enum(keys(ARTICLE_STATUSES)),
    verification: z.enum(keys(ARTICLE_VERIFICATIONS)),
    source: z.uuid().optional(),
    source_titre: z.string().trim().min(3, "3 caractères au moins.").max(200).optional(),
    source_type: z.enum(keys(SOURCE_KINDS)).optional(),
    source_editeur: z.string().trim().max(200).optional(),
    source_url: z.url({ protocol: /^https?$/, error: "Adresse web invalide." }).optional(),
    source_date: z.iso.date({ error: "Date invalide." }).optional(),
    note: z.string().trim().min(3, "Décrivez la modification (3 caractères au moins).").max(300),
  })
  .refine((value) => value.verification !== "verified" || value.source || value.source_titre, {
    message: "Un article vérifié cite sa source : choisissez-en une ou créez-la.",
    path: ["source"],
  });

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

/** Enregistre un article : chaque changement du texte crée une version avec sa note (règles en base). */
export async function saveArticleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = [
    "id", "rubrique", "slug", "titre", "resume", "corps", "statut", "verification", "source",
    "source_titre", "source_type", "source_editeur", "source_url", "source_date", "note",
  ] as const;
  const parsed = articleSchema.safeParse(Object.fromEntries(fields.map((name) => [name, read(formData, name)])));
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const data = parsed.data;
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Rédaction momentanément indisponible.", values: formValues(formData) };

  let sourceId = data.source ?? null;
  if (!sourceId && data.source_titre) {
    const { data: source, error } = await supabase
      .from("sources")
      .insert({
        title: data.source_titre,
        kind: data.source_type ?? "autre",
        publisher: data.source_editeur ?? null,
        url: data.source_url ?? null,
        collected_at: data.source_date ?? new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !source) {
      logger.error("Source non créée", { module: "guide", code: error?.code });
      return { status: "error", message: "La source n’a pas pu être créée (réservé à l’équipe locale).", values: formValues(formData) };
    }
    sourceId = source.id;
  }

  const slug = data.id ? (data.slug ?? "") : slugify(data.slug ?? data.titre);
  if (!data.id && !slug) return { status: "error", fieldErrors: { slug: "Adresse invalide." }, values: formValues(formData) };
  // p_id et p_source acceptent null (création, article sans source) : les types générés ne le disent pas.
  const args = {
    p_id: data.id ?? null,
    p_section: data.rubrique,
    p_slug: slug,
    p_title: data.titre,
    p_summary: data.resume ?? "",
    p_body: data.corps,
    p_status: data.statut,
    p_verification: data.verification,
    p_source: sourceId,
    p_change_note: data.note,
  } as unknown as Database["public"]["Functions"]["save_guide_article"]["Args"];
  const { data: id, error } = await supabase.rpc("save_guide_article", args);
  if (error || !id) {
    if (error?.code === "23505") return { status: "error", fieldErrors: { slug: `L’adresse « ${slug} » existe déjà.` }, values: formValues(formData) };
    if (error && ["42501", "23514"].includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Article du guide non enregistré", { module: "guide", code: error?.code });
    return { status: "error", message: "L’article n’a pas pu être enregistré.", values: formValues(formData) };
  }
  updateTag(GUIDE_CACHE_TAG);
  redirect(href("adminGuideArticle", { params: { id: String(id) }, query: { enregistre: "1" } }));
}

const decisionSchema = z.object({
  suggestion: z.uuid(),
  article: z.uuid(),
  decision: z.enum(keys(SUGGESTION_DECISIONS)),
  reponse: z.string().trim().max(1000, "1 000 caractères au maximum.").optional(),
});

/** Traitement d'une suggestion : statut et réponse ; le message de l'auteur ne change pas (règle en base). */
export async function decideSuggestionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = decisionSchema.safeParse({
    suggestion: read(formData, "suggestion"),
    article: read(formData, "article"),
    decision: read(formData, "decision"),
    reponse: read(formData, "reponse"),
  });
  if (!parsed.success) return { status: "error", message: "Décision invalide.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };
  const { data, error } = await supabase
    .from("guide_suggestions")
    .update({ status: parsed.data.decision, resolution_note: parsed.data.reponse ?? null })
    .eq("id", parsed.data.suggestion)
    .select("id");
  if (error || !data?.length) {
    if (error) logger.error("Suggestion non traitée", { module: "guide", code: error.code });
    return { status: "error", message: "La décision n’a pas pu être enregistrée (réservé à l’équipe locale)." };
  }
  revalidatePath(href("adminGuideArticle", { params: { id: parsed.data.article } }));
  return { status: "success", message: `Suggestion : ${SUGGESTION_DECISIONS[parsed.data.decision].toLowerCase()}.` };
}
