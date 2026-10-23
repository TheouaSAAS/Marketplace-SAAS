"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { isStaff } from "@/domain/roles";
import type { FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { slugify } from "@/modules/admin/domain/categories";
import { LISTINGS_CACHE_TAG } from "@/modules/listings/server/queries";
import { getCityContext } from "@/server/city-context";
import { getCurrentAccount, getSessionUser } from "@/server/auth";
import { consumeRateLimit } from "@/server/rate-limit";
import { extractFromText, type Suggestion } from "../domain/assistant";
import { cleanAttributes, draftSchema, submissionProblems, type ListingDraft } from "../domain/fields";
import { isPhotoType, PHOTO_MAX_BYTES } from "../domain/photos";
import { checkListing } from "../domain/rules";
import { aiAvailability, extractWithAi, type AiInput } from "./ai";
import { promotePhotos } from "./photo-store";
import { publishableCategories, type StoredSuggestion } from "./queries";

const SHOWN_CODES = ["23514", "42501", "CP429"];

async function session() {
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: href("publish") } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) throw new Error("Base indisponible");
  return { user, supabase };
}

function failure(error: { code: string; message: string }, fallback: string): { ok: false; message: string } {
  if (SHOWN_CODES.includes(error.code)) return { ok: false, message: error.message };
  logger.error(fallback, { module: "publication", code: error.code });
  return { ok: false, message: `${fallback}. Réessayez.` };
}

async function schemaOf(categoryId: string): Promise<string | null | undefined> {
  const { flat } = await publishableCategories();
  const category = flat.find((item) => item.id === categoryId);
  return category ? category.schema : undefined;
}

// -----------------------------------------------------------------------------
// Brouillon : création, enregistrement automatique, suppression
// -----------------------------------------------------------------------------
const startSchema = z.object({ categorie: z.uuid(), texte: z.string().trim().max(10000).optional(), page: z.uuid().optional() });

/** Crée un brouillon privé dans la catégorie choisie ; un texte libre éventuel devient des suggestions (règles). */
export async function startDraftAction(formData: FormData): Promise<void> {
  const parsed = startSchema.safeParse({ categorie: formData.get("categorie"), texte: formData.get("texte") || undefined, page: formData.get("page") || undefined });
  if (!parsed.success) redirect(href("publish"));
  const account = await getCurrentAccount();
  if (!account) redirect(href("login", { query: { suivant: href("publish") } }));
  if (account.isSuspended) redirect(href("publish"));
  const schema = await schemaOf(parsed.data.categorie);
  if (schema === undefined) redirect(href("publish"));
  if (!(await consumeRateLimit("listingDraft", account.id))) redirect(href("publish", { query: { limite: "1" } }));
  const { supabase } = await session();
  const { current } = await getCityContext();
  if (!current.id) redirect(href("publish"));
  // Au nom d'une page professionnelle : rattachée à la page et à son équipe.
  const page = parsed.data.page ? (await supabase.from("business_profiles").select("id, organization_id").eq("id", parsed.data.page).maybeSingle()).data : null;
  const { data, error } = await supabase
    .from("listings")
    .insert({
      owner_id: account.id,
      business_id: page?.id ?? null,
      organization_id: page?.organization_id ?? null,
      slug: `brouillon-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      title: "",
      description: "",
      category_id: parsed.data.categorie,
      city_id: current.id,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) {
    logger.error("Brouillon non créé", { module: "publication", code: error?.code });
    redirect(href("publish", { query: { erreur: "1" } }));
  }
  if (parsed.data.texte) await storeSuggestions(supabase, data.id, extractFromText(parsed.data.texte, schema, new Date()));
  redirect(href("publishEditor", { params: { id: data.id } }));
}

const saveSchema = z.object({ id: z.uuid(), categoryId: z.uuid(), draft: draftSchema });

export type SaveResult = { ok: true; savedAt: string } | { ok: false; message: string };

/** Enregistrement automatique d'un brouillon (incomplet accepté). Ne touche jamais une annonce soumise ou publiée. */
export async function saveDraftAction(input: { id: string; categoryId: string; draft: ListingDraft }): Promise<SaveResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  const { id, categoryId, draft } = parsed.data;
  const schema = await schemaOf(categoryId);
  if (schema === undefined) return { ok: false, message: "Catégorie non disponible." };
  const { supabase } = await session();
  const located = draft.lat !== null && draft.lng !== null;
  const { data, error } = await supabase
    .from("listings")
    .update({
      category_id: categoryId,
      title: draft.title,
      description: draft.description,
      price: draft.price,
      price_unit: draft.price === null ? null : draft.priceUnit,
      is_negotiable: draft.negotiable,
      neighborhood_id: draft.neighborhoodId,
      location: located ? `SRID=4326;POINT(${draft.lng} ${draft.lat})` : null,
      location_precision: located ? (draft.exact ? "exact" : "approximate") : "unknown",
      public_location_precision: draft.exact ? draft.publicPrecision : draft.publicPrecision === "exact" ? "approximate" : draft.publicPrecision,
      attributes: cleanAttributes(schema, draft.attributes) as never,
      contact_name: draft.contactName,
      contact_phone: draft.contactPhone,
      contact_whatsapp: draft.contactWhatsapp,
      contact_email: draft.contactEmail,
      show_phone: draft.showPhone && Boolean(draft.contactPhone),
      show_whatsapp: draft.showWhatsapp && Boolean(draft.contactWhatsapp),
      show_email: draft.showEmail && Boolean(draft.contactEmail),
    })
    .eq("id", id)
    .eq("status", "draft")
    .select("updated_at");
  if (error) return failure(error, "Le brouillon n’a pas pu être enregistré");
  if (!data?.length) return { ok: false, message: "Ce brouillon n’est plus modifiable (soumis, publié ou supprimé)." };
  return { ok: true, savedAt: data[0]!.updated_at };
}

/** Une annonce refusée ou retirée de la modération redevient un brouillon modifiable. */
export async function reopenAsDraftAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("annonce"));
  if (!id.success) redirect(href("myListings"));
  const { supabase } = await session();
  const { error } = await supabase.from("listings").update({ status: "draft" }).eq("id", id.data).in("status", ["rejected", "pending"]);
  if (error) logger.error("Annonce non rouverte", { module: "publication", code: error.code });
  redirect(href("publishEditor", { params: { id: id.data } }));
}

/** Supprime un brouillon et ses photos privées. */
export async function deleteDraftAction(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("annonce"));
  // Suppression définitive : confirmation explicite exigée.
  if (!id.success || formData.get("confirmer") !== "1") redirect(href("myListings"));
  const { supabase } = await session();
  const { data: photos } = await supabase.from("images").select("storage_path, bucket").eq("listing_id", id.data);
  const { error } = await supabase.from("listings").delete().eq("id", id.data).eq("status", "draft");
  if (error) {
    logger.error("Brouillon non supprimé", { module: "publication", code: error.code });
    redirect(href("myListings"));
  }
  const paths = (photos ?? []).filter((photo) => photo.bucket === "private-media").map((photo) => photo.storage_path);
  if (paths.length) await supabase.storage.from("private-media").remove(paths);
  redirect(href("myListings", { query: { supprime: "1" } }));
}

// -----------------------------------------------------------------------------
// Assistant : suggestions (règles ou IA), décisions tracées
// -----------------------------------------------------------------------------
const SUGGESTION_COLUMNS = "id, field, value, origin, input_kind, confidence, excerpt, model, status, previous_value, created_at";

async function storeSuggestions(
  supabase: Awaited<ReturnType<typeof session>>["supabase"],
  listingId: string,
  suggestions: Suggestion[],
  model: string | null = null,
): Promise<{ ok: true; rows: StoredSuggestion[] } | { ok: false; message: string }> {
  if (!suggestions.length) return { ok: true, rows: [] };
  const { data, error } = await supabase.from("listing_suggestions").insert(
    suggestions.map((suggestion) => ({
      listing_id: listingId,
      field: suggestion.field,
      value: suggestion.value as never,
      origin: suggestion.origin,
      input_kind: suggestion.input,
      confidence: suggestion.confidence,
      excerpt: suggestion.excerpt?.slice(0, 300) ?? null,
      model: suggestion.origin === "ia" ? model : null,
    })),
  ).select(SUGGESTION_COLUMNS);
  if (error) return failure(error, "Les suggestions n’ont pas pu être enregistrées");
  return { ok: true, rows: (data ?? []).map((row) => ({ ...row, confidence: Number(row.confidence) })) as StoredSuggestion[] };
}

export type AnalyzeResult = { ok: true; suggestions: StoredSuggestion[]; notes: string[]; aiMessage: string | null } | { ok: false; message: string };

const analyzeTextSchema = z.object({ id: z.uuid(), categoryId: z.uuid(), text: z.string().trim().min(3, "Collez un texte à analyser.").max(20000, "20 000 caractères au plus."), useAi: z.boolean() });

/** Analyse d'un texte collé : règles toujours, IA en plus si demandée et disponible. */
export async function analyzeTextAction(input: { id: string; categoryId: string; text: string; useAi: boolean }): Promise<AnalyzeResult> {
  const parsed = analyzeTextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Texte invalide." };
  const { id, categoryId, text, useAi } = parsed.data;
  const schema = await schemaOf(categoryId);
  if (schema === undefined) return { ok: false, message: "Catégorie non disponible." };
  const { user, supabase } = await session();
  const rules = await storeSuggestions(supabase, id, extractFromText(text, schema, new Date()));
  if (!rules.ok) return rules;
  if (!useAi) return { ok: true, suggestions: rules.rows, notes: [], aiMessage: null };
  if (!(await consumeRateLimit("aiAssist", user.id))) return { ok: true, suggestions: rules.rows, notes: [], aiMessage: "Limite quotidienne de l’assistant IA atteinte." };
  const ai = await extractWithAi({ kind: "texte", text }, schema, user.id);
  if (!ai.ok) return { ok: true, suggestions: rules.rows, notes: [], aiMessage: ai.message };
  const stored = await storeSuggestions(supabase, id, ai.suggestions, "assistant IA");
  if (!stored.ok) return stored;
  return { ok: true, suggestions: [...stored.rows, ...rules.rows], notes: ai.notes, aiMessage: null };
}

const PDF_MAX_BYTES = 10 * 1024 * 1024;

/** Import d'un PDF (IA seulement) : le fichier est lu en mémoire, jamais conservé. */
export async function analyzePdfAction(formData: FormData): Promise<AnalyzeResult> {
  const id = z.uuid().safeParse(formData.get("annonce"));
  const categoryId = z.uuid().safeParse(formData.get("categorie"));
  const file = formData.get("fichier");
  if (!id.success || !categoryId.success || !(file instanceof File)) return { ok: false, message: "Choisissez un fichier PDF." };
  if (file.size === 0 || file.size > PDF_MAX_BYTES) return { ok: false, message: "PDF de 10 Mo au plus." };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, message: "Ce fichier n’est pas un PDF." };
  return analyzeWithAi(id.data, categoryId.data, { kind: "pdf", base64: bytes.toString("base64") });
}

/** Analyse d'une photo déjà déposée (IA seulement) : description prudente et qualité. */
export async function analyzePhotoAction(input: { id: string; categoryId: string; photoId: string }): Promise<AnalyzeResult> {
  const parsed = z.object({ id: z.uuid(), categoryId: z.uuid(), photoId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Photo introuvable." };
  const { supabase } = await session();
  const { data: photo } = await supabase.from("images").select("storage_path, bucket").eq("id", parsed.data.photoId).eq("listing_id", parsed.data.id).maybeSingle();
  if (!photo) return { ok: false, message: "Photo introuvable." };
  const { data: blob, error } = await supabase.storage.from(photo.bucket).download(photo.storage_path);
  if (error || !blob || !isPhotoType(blob.type) || blob.size > PHOTO_MAX_BYTES) return { ok: false, message: "Photo illisible." };
  const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  return analyzeWithAi(parsed.data.id, parsed.data.categoryId, { kind: "photo", mediaType: blob.type, base64 });
}

async function analyzeWithAi(listingId: string, categoryId: string, input: AiInput): Promise<AnalyzeResult> {
  const schema = await schemaOf(categoryId);
  if (schema === undefined) return { ok: false, message: "Catégorie non disponible." };
  const availability = await aiAvailability();
  if (!availability.available) return { ok: false, message: availability.reason ?? "Assistant IA indisponible." };
  const { user, supabase } = await session();
  if (!(await consumeRateLimit("aiAssist", user.id))) return { ok: false, message: "Limite quotidienne de l’assistant IA atteinte." };
  const ai = await extractWithAi(input, schema, user.id);
  if (!ai.ok) return ai;
  const stored = await storeSuggestions(supabase, listingId, ai.suggestions, "assistant IA");
  if (!stored.ok) return stored;
  return { ok: true, suggestions: stored.rows, notes: ai.notes, aiMessage: null };
}

const decisionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["acceptee", "rejetee", "annulee"]),
  previous: z.unknown().optional(),
});

/** Décision de l'auteur sur une suggestion : tracée en base (qui, quand, valeur remplacée). */
export async function decideSuggestionAction(input: { id: string; decision: "acceptee" | "rejetee" | "annulee"; previous?: unknown }): Promise<{ ok: boolean; message?: string }> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Décision invalide." };
  const { supabase } = await session();
  const { data, error } = await supabase
    .from("listing_suggestions")
    .update({ status: parsed.data.decision, ...(parsed.data.decision === "acceptee" ? { previous_value: (parsed.data.previous ?? null) as never } : {}) })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return failure(error, "Décision non enregistrée");
  return data?.length ? { ok: true } : { ok: false, message: "Suggestion introuvable." };
}

// -----------------------------------------------------------------------------
// Soumission, retrait, modération
// -----------------------------------------------------------------------------
export interface SubmitState extends FormState {
  problems?: string[];
}

/** Soumission à la modération après contrôle des champs obligatoires et des contenus interdits. */
export async function submitListingAction(_previous: SubmitState, formData: FormData): Promise<SubmitState> {
  const id = z.uuid().safeParse(formData.get("annonce"));
  if (!id.success) return { status: "error", message: "Annonce introuvable." };
  const { supabase } = await session();
  const { data: listing } = await supabase.from("listings").select("id, slug, status, title, description, category_id, attributes").eq("id", id.data).maybeSingle();
  if (!listing || listing.status !== "draft") return { status: "error", message: "Seul un brouillon peut être soumis." };
  const schema = await schemaOf(listing.category_id);
  if (schema === undefined) return { status: "error", message: "Catégorie non disponible." };
  const { data: point } = await supabase.rpc("listing_editor_point", { p_listing: listing.id });
  const draft = draftSchema.parse({ title: listing.title, description: listing.description, lat: point?.[0]?.lat ?? null, lng: point?.[0]?.lng ?? null });
  const problems = submissionProblems(draft, schema).map((problem) => problem.message);
  const hits = checkListing(`${listing.title}\n${listing.description}\n${JSON.stringify(listing.attributes)}`);
  problems.push(...hits.map((hit) => `${hit.rule} (« ${hit.excerpt} ») : ${hit.advice}`));
  if (problems.length) return { status: "error", message: "L’annonce ne peut pas encore être soumise.", problems };
  const slug = listing.slug.startsWith("brouillon-") ? `${slugify(listing.title).slice(0, 60) || "annonce"}-${crypto.randomUUID().slice(0, 6)}` : listing.slug;
  const { error } = await supabase.from("listings").update({ status: "pending", slug }).eq("id", listing.id).eq("status", "draft");
  if (error) {
    const result = failure(error, "L’annonce n’a pas pu être soumise");
    return { status: "error", message: result.message };
  }
  redirect(href("myListings", { query: { soumise: "1" } }));
}

const moderationSchema = z
  .object({ annonce: z.uuid(), decision: z.enum(["publier", "refuser"]), motif: z.string().trim().max(500).optional() })
  .refine((value) => value.decision === "publier" || (value.motif?.length ?? 0) >= 5, { message: "Motivez le refus (5 caractères au moins).", path: ["motif"] });

/**
 * Décision de modération (équipe). À la publication, les photos passent du
 * stockage privé au stockage public (clé secrète, après vérification du rôle),
 * puis l'annonce est publiée ; l'auteur est notifié par la base.
 */
export async function moderateListingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = moderationSchema.safeParse({ annonce: formData.get("annonce"), decision: formData.get("decision"), motif: formData.get("motif") || undefined });
  if (!parsed.success) return { status: "error", fieldErrors: { motif: parsed.error.issues[0]?.message ?? "Décision invalide." } };
  const account = await getCurrentAccount();
  if (!account || !isStaff(account.role)) return { status: "error", message: "Réservé à l’équipe de modération." };
  const { supabase } = await session();
  const { data: listing } = await supabase.from("listings").select("id, status").eq("id", parsed.data.annonce).maybeSingle();
  if (!listing || listing.status !== "pending") return { status: "error", message: "Cette annonce n’est plus en attente." };

  if (parsed.data.decision === "publier") {
    const promoted = await promotePhotos({ kind: "annonce", id: listing.id });
    if (!promoted) return { status: "error", message: "Les photos n’ont pas pu être publiées. Réessayez." };
  }
  const { error } = await supabase
    .from("listings")
    .update(parsed.data.decision === "publier" ? { status: "published" } : { status: "rejected", rejection_reason: parsed.data.motif! })
    .eq("id", listing.id)
    .eq("status", "pending");
  if (error) {
    logger.error("Décision de modération non enregistrée", { module: "publication", code: error.code });
    return { status: "error", message: SHOWN_CODES.includes(error.code) ? error.message : "Décision non enregistrée. Réessayez." };
  }
  updateTag(LISTINGS_CACHE_TAG);
  revalidatePath(href("adminListings"));
  redirect(href("adminListings", { query: { decision: parsed.data.decision === "publier" ? "publiee" : "refusee" } }));
}
