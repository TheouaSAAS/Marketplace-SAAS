"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { isCurator, isStaff } from "@/domain/roles";
import { publicEnv } from "@/lib/env";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { slugify } from "@/modules/admin/domain/categories";
import { WEEK_DAYS } from "@/modules/shops/domain/hours";
import { promotePhotos } from "@/modules/publishing/server/photo-store";
import { getCityContext } from "@/server/city-context";
import { getCurrentAccount, getSessionUser } from "@/server/auth";
import { consumeRateLimit } from "@/server/rate-limit";
import { ORGANIZATION_KINDS, pageSchema, parseWeekHours, splitList, type OrganizationKind } from "../domain/pro";
import { generateProText } from "./pro-ai";
import { BUSINESSES_CACHE_TAG } from "./queries";
import { closedFeatureMessage, isFeatureEnabled } from "@/server/features";

const SHOWN_CODES = ["23514", "42501", "23505", "CP429"];

async function session(back: string) {
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) throw new Error("Base indisponible");
  return { user, supabase };
}

function databaseError(error: { code: string; message: string }, fallback: string, formData?: FormData): FormState {
  if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message, values: formData ? formValues(formData) : undefined };
  logger.error(fallback, { module: "pages-pro", code: error.code });
  return { status: "error", message: `${fallback}. Réessayez.`, values: formData ? formValues(formData) : undefined };
}

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const editorPath = (id: string) => href("proPageEditor", { params: { id } });

// -----------------------------------------------------------------------------
// Création et contenu de la page
// -----------------------------------------------------------------------------
const createSchema = z.object({
  nom: z.string().trim().min(2, "Nom trop court.").max(120),
  categorie: z.uuid("Choisissez une catégorie."),
});

/** Crée une page en brouillon (le titulaire la complète puis la soumet). */
export async function createProPageAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!isFeatureEnabled("pro_publishing")) return { status: "error", message: closedFeatureMessage("pro_publishing") };
  const parsed = createSchema.safeParse({ nom: formData.get("nom"), categorie: formData.get("categorie") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const account = await getCurrentAccount();
  if (!account) redirect(href("login", { query: { suivant: href("proPages") } }));
  if (account.isSuspended) return { status: "error", message: "Compte suspendu : création impossible." };
  const { supabase } = await session(href("proPages"));
  const { current } = await getCityContext();
  if (!current.id) return { status: "error", message: "Service momentanément indisponible." };
  const { data, error } = await supabase
    .from("business_profiles")
    .insert({
      owner_id: account.id,
      name: parsed.data.nom,
      slug: `${slugify(parsed.data.nom).slice(0, 60) || "pro"}-${crypto.randomUUID().slice(0, 6)}`,
      category_id: parsed.data.categorie,
      city_id: current.id,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return error ? databaseError(error, "La page n’a pas pu être créée", formData) : { status: "error", message: "La page n’a pas pu être créée." };
  redirect(editorPath(data.id));
}

/** Enregistre la page ; une page publiée modifiée repart en relecture (règle en base), sauf la disponibilité. */
export async function saveProPageAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("page"));
  if (!id.success) return { status: "error", message: "Page introuvable." };
  const links = Array.from({ length: 6 }, (_, index) => ({ label: read(formData, `lien_titre_${index}`).trim(), url: read(formData, `lien_url_${index}`).trim() })).filter((link) => link.label || link.url);
  const faq = Array.from({ length: 10 }, (_, index) => ({ question: read(formData, `faq_q_${index}`).trim(), answer: read(formData, `faq_r_${index}`).trim() })).filter((item) => item.question || item.answer);
  const parsed = pageSchema.safeParse({
    name: read(formData, "nom"),
    categoryId: read(formData, "categorie"),
    neighborhoodId: read(formData, "quartier") || null,
    description: read(formData, "presentation"),
    services: splitList(read(formData, "prestations"), 30, 80),
    serviceArea: read(formData, "zone"),
    availabilityNote: read(formData, "disponibilite"),
    acceptsQuotes: formData.get("devis") === "1",
    phone: read(formData, "telephone"),
    whatsapp: read(formData, "whatsapp"),
    email: read(formData, "email"),
    website: read(formData, "site"),
    links,
    faq,
  });
  const hours = parseWeekHours(Object.fromEntries(WEEK_DAYS.map((day) => [day, read(formData, `horaires_${day}`)])));
  if (!parsed.success || !hours.ok) {
    const errors = { ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)), ...(hours.ok ? {} : hours.errors) };
    return { status: "error", message: "Certaines informations sont à corriger.", fieldErrors: errors, values: formValues(formData) };
  }
  const data = parsed.data;
  const { supabase } = await session(editorPath(id.data));
  const { data: before } = await supabase.from("business_profiles").select("status, slug").eq("id", id.data).maybeSingle();
  if (!before) return { status: "error", message: "Page introuvable ou accès refusé." };
  const { data: after, error } = await supabase
    .from("business_profiles")
    .update({
      name: data.name,
      category_id: data.categoryId,
      neighborhood_id: data.neighborhoodId,
      description: data.description,
      services: data.services,
      service_area: data.serviceArea,
      availability_note: data.availabilityNote,
      accepts_quotes: data.acceptsQuotes,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      website: data.website,
      links: data.links,
      faq: data.faq,
      opening_hours: Object.keys(hours.hours).length ? hours.hours : null,
    })
    .eq("id", id.data)
    .select("status")
    .maybeSingle();
  if (error) return databaseError(error, "La page n’a pas pu être enregistrée", formData);
  if (!after) return { status: "error", message: "Vous n’avez pas le droit de modifier cette page." };
  updateTag(BUSINESSES_CACHE_TAG);
  revalidatePath(editorPath(id.data));
  const backToReview = before.status === "published" && after.status === "pending";
  return {
    status: "success",
    message: backToReview
      ? "Modifications enregistrées. La page est relue par l’équipe avant sa remise en ligne."
      : before.status === "published"
        ? "Disponibilité enregistrée : elle est visible tout de suite."
        : "Page enregistrée.",
  };
}

/** Soumission à la modération (brouillon ou page refusée). */
export async function submitProPageAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!isFeatureEnabled("pro_publishing")) return { status: "error", message: closedFeatureMessage("pro_publishing") };
  const id = z.uuid().safeParse(formData.get("page"));
  if (!id.success) return { status: "error", message: "Page introuvable." };
  const { supabase } = await session(editorPath(id.data));
  const { data, error } = await supabase.from("business_profiles").update({ status: "pending" }).eq("id", id.data).in("status", ["draft", "rejected"]).select("id");
  if (error) return databaseError(error, "La page n’a pas pu être soumise");
  if (!data?.length) return { status: "error", message: "Cette page n’est pas un brouillon." };
  revalidatePath(editorPath(id.data));
  redirect(href("proPages", { query: { soumise: "1" } }));
}

// -----------------------------------------------------------------------------
// Équipe
// -----------------------------------------------------------------------------
const teamSchema = z.object({ page: z.uuid(), type: z.enum(Object.keys(ORGANIZATION_KINDS) as [OrganizationKind, ...OrganizationKind[]]) });

/** Crée l'équipe d'une page : le titulaire en devient propriétaire, la page lui est rattachée. */
export async function createTeamAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!isFeatureEnabled("pro_publishing")) return { status: "error", message: closedFeatureMessage("pro_publishing") };
  const parsed = teamSchema.safeParse({ page: formData.get("page"), type: formData.get("type") });
  if (!parsed.success) return { status: "error", message: "Choisissez le type d’organisation." };
  const { user, supabase } = await session(editorPath(parsed.data.page));
  const { data: page } = await supabase.from("business_profiles").select("id, name, city_id, owner_id, organization_id").eq("id", parsed.data.page).maybeSingle();
  if (!page || page.owner_id !== user.id) return { status: "error", message: "Seul le titulaire de la page crée son équipe." };
  if (page.organization_id) return { status: "error", message: "Cette page a déjà une équipe." };
  const { data: organization, error } = await supabase
    .from("organizations")
    .insert({ name: page.name, slug: `${slugify(page.name).slice(0, 60) || "equipe"}-${crypto.randomUUID().slice(0, 6)}`, kind: parsed.data.type, city_id: page.city_id, created_by: user.id })
    .select("id")
    .single();
  if (error || !organization) return error ? databaseError(error, "L’équipe n’a pas pu être créée") : { status: "error", message: "L’équipe n’a pas pu être créée." };
  const { error: link } = await supabase.from("business_profiles").update({ organization_id: organization.id }).eq("id", page.id);
  if (link) return databaseError(link, "L’équipe n’a pas pu être rattachée à la page");
  revalidatePath(editorPath(page.id));
  return { status: "success", message: "Équipe créée : invitez vos collaborateurs." };
}

const inviteSchema = z.object({ page: z.uuid(), equipe: z.uuid(), role: z.enum(["admin", "editor", "viewer"]) });

export interface InviteState extends FormState {
  link?: string;
}

/** Invitation par lien à usage unique (7 jours) : le lien n'est montré qu'une fois. */
export async function inviteAction(_previous: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({ page: formData.get("page"), equipe: formData.get("equipe"), role: formData.get("role") });
  if (!parsed.success) return { status: "error", message: "Choisissez un rôle." };
  const { supabase } = await session(editorPath(parsed.data.page));
  const { data, error } = await supabase.rpc("create_organization_invitation", { p_organization: parsed.data.equipe, p_role: parsed.data.role });
  if (error || !data) return error ? databaseError(error, "L’invitation n’a pas pu être créée") : { status: "error", message: "L’invitation n’a pas pu être créée." };
  revalidatePath(editorPath(parsed.data.page));
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    status: "success",
    message: "Lien créé. Copiez-le maintenant et envoyez-le à la personne : il ne sera plus affiché.",
    link: `${base}${href("proInvitation", { params: { jeton: data } })}`,
  };
}

export async function revokeInvitationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ page: z.uuid(), invitation: z.uuid() }).safeParse({ page: formData.get("page"), invitation: formData.get("invitation") });
  if (!parsed.success) return { status: "error", message: "Invitation introuvable." };
  const { supabase } = await session(editorPath(parsed.data.page));
  const { error } = await supabase.rpc("revoke_organization_invitation", { p_invitation: parsed.data.invitation });
  if (error) return databaseError(error, "L’invitation n’a pas pu être révoquée");
  revalidatePath(editorPath(parsed.data.page));
  return { status: "success", message: "Invitation révoquée." };
}

const memberSchema = z.object({ page: z.uuid(), membre: z.uuid(), role: z.enum(["owner", "admin", "editor", "viewer", "retirer"]) });

/** Rôle d'un membre ou retrait ; la base réserve ces gestes aux administrateurs et protège le dernier propriétaire. */
export async function updateMemberAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = memberSchema.safeParse({ page: formData.get("page"), membre: formData.get("membre"), role: formData.get("role") });
  if (!parsed.success) return { status: "error", message: "Choix invalide." };
  const { supabase } = await session(editorPath(parsed.data.page));
  const query =
    parsed.data.role === "retirer"
      ? supabase.from("organization_members").delete().eq("id", parsed.data.membre).select("id")
      : supabase.from("organization_members").update({ role: parsed.data.role }).eq("id", parsed.data.membre).select("id");
  const { data, error } = await query;
  if (error) return databaseError(error, "Le changement n’a pas pu être enregistré");
  if (!data?.length) return { status: "error", message: "Vous n’avez pas le droit de gérer ce membre." };
  revalidatePath(editorPath(parsed.data.page));
  return { status: "success", message: parsed.data.role === "retirer" ? "Membre retiré de l’équipe." : "Rôle mis à jour." };
}

export async function acceptInvitationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = z.string().regex(/^[0-9a-f]{64}$/).safeParse(formData.get("jeton"));
  if (!token.success) return { status: "error", message: "Lien d’invitation invalide." };
  const { supabase } = await session(href("proPages"));
  const { error } = await supabase.rpc("accept_organization_invitation", { p_token: token.data });
  if (error) return databaseError(error, "L’invitation n’a pas pu être acceptée");
  redirect(href("proPages", { query: { equipe: "1" } }));
}

// -----------------------------------------------------------------------------
// Vérification, avis, revendication
// -----------------------------------------------------------------------------
export async function requestVerificationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ page: z.uuid(), preuve: z.string().trim().min(10, "Décrivez l’élément vérifiable (10 caractères au moins).").max(1000) })
    .safeParse({ page: formData.get("page"), preuve: formData.get("preuve") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const { supabase } = await session(editorPath(parsed.data.page));
  const { error } = await supabase.from("business_verification_requests").insert({ business_id: parsed.data.page, evidence: parsed.data.preuve });
  if (error) {
    if (error.code === "23505") return { status: "success", message: "Une demande est déjà en cours d’examen." };
    if (error.code === "42501") return { status: "error", message: "La vérification se demande pour une page publiée, par son équipe." };
    return databaseError(error, "La demande n’a pas pu être envoyée", formData);
  }
  updateTag(BUSINESSES_CACHE_TAG);
  revalidatePath(editorPath(parsed.data.page));
  return { status: "success", message: "Demande envoyée : l’équipe locale vous contactera pour contrôler l’élément indiqué." };
}

const reviewSchema = z.object({
  page: z.uuid(),
  retour: z.string(),
  note: z.coerce.number().int().min(1, "Choisissez une note.").max(5),
  texte: z
    .string()
    .trim()
    .max(3000)
    .refine((value) => value === "" || value.length >= 10, "Dix caractères au moins, ou laissez vide.")
    .transform((value) => value || null),
});

/** Avis d'un client : modéré avant publication ; la base applique les règles anti-manipulation. */
export async function submitReviewAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = reviewSchema.safeParse({ page: formData.get("page"), retour: formData.get("retour"), note: formData.get("note"), texte: formData.get("texte") ?? "" });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const { user, supabase } = await session(parsed.data.retour);
  const { error } = await supabase.from("reviews").insert({ author_id: user.id, business_id: parsed.data.page, rating: parsed.data.note, body: parsed.data.texte });
  if (error) {
    if (error.code === "23505") return { status: "success", message: "Vous avez déjà donné votre avis sur ce professionnel." };
    return databaseError(error, "L’avis n’a pas pu être envoyé", formData);
  }
  return { status: "success", message: "Merci ! Votre avis sera publié après relecture par l’équipe de modération." };
}

export async function respondReviewAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ page: z.uuid(), avis: z.uuid(), reponse: z.string().trim().min(2, "Réponse trop courte.").max(2000) })
    .safeParse({ page: formData.get("page"), avis: formData.get("avis"), reponse: formData.get("reponse") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const { supabase } = await session(editorPath(parsed.data.page));
  const { data, error } = await supabase.from("reviews").update({ response_body: parsed.data.reponse }).eq("id", parsed.data.avis).select("id");
  if (error) return databaseError(error, "La réponse n’a pas pu être enregistrée", formData);
  if (!data?.length) return { status: "error", message: "Avis introuvable." };
  updateTag(BUSINESSES_CACHE_TAG);
  revalidatePath(editorPath(parsed.data.page));
  return { status: "success", message: "Réponse publiée sous l’avis." };
}

// -----------------------------------------------------------------------------
// Aide à la rédaction (IA facultative)
// -----------------------------------------------------------------------------
export type ProTextResult = { ok: true; presentation: string; faq: { question: string; answer: string }[] } | { ok: false; message: string };

/** Propose une présentation et une FAQ à partir des seules informations de la page ; rien n'est enregistré. */
export async function generateProTextAction(input: { page: string }): Promise<ProTextResult> {
  const id = z.uuid().safeParse(input.page);
  if (!id.success) return { ok: false, message: "Page introuvable." };
  const { user, supabase } = await session(editorPath(id.data));
  const { data: page } = await supabase
    .from("business_profiles")
    .select("name, description, services, service_area, opening_hours, category:categories(name), neighborhood:neighborhoods(name)")
    .eq("id", id.data)
    .maybeSingle();
  if (!page) return { ok: false, message: "Page introuvable." };
  if (!(await consumeRateLimit("aiAssist", user.id))) return { ok: false, message: "Limite quotidienne de l’assistant IA atteinte." };
  return generateProText(
    {
      name: page.name,
      category: (page.category as { name: string } | null)?.name ?? null,
      neighborhood: (page.neighborhood as { name: string } | null)?.name ?? null,
      description: page.description,
      services: page.services,
      serviceArea: page.service_area,
    },
    user.id,
  );
}

// -----------------------------------------------------------------------------
// Modération (équipe)
// -----------------------------------------------------------------------------
const moderationSchema = z
  .object({ page: z.uuid(), decision: z.enum(["publier", "refuser"]), motif: z.string().trim().max(500).optional() })
  .refine((value) => value.decision === "publier" || (value.motif?.length ?? 0) >= 5, { message: "Motivez le refus (5 caractères au moins).", path: ["motif"] });

export async function moderateProPageAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = moderationSchema.safeParse({ page: formData.get("page"), decision: formData.get("decision"), motif: formData.get("motif") || undefined });
  if (!parsed.success) return { status: "error", fieldErrors: { motif: parsed.error.issues[0]?.message ?? "Décision invalide." } };
  const account = await getCurrentAccount();
  if (!account || !isStaff(account.role)) return { status: "error", message: "Réservé à l’équipe de modération." };
  const { supabase } = await session(href("adminPros"));
  if (parsed.data.decision === "publier" && !(await promotePhotos({ kind: "pro", id: parsed.data.page }))) {
    return { status: "error", message: "Les photos n’ont pas pu être publiées. Réessayez." };
  }
  const { data, error } = await supabase
    .from("business_profiles")
    .update(parsed.data.decision === "publier" ? { status: "published" } : { status: "rejected", rejection_reason: parsed.data.motif! })
    .eq("id", parsed.data.page)
    .eq("status", "pending")
    .select("id");
  if (error) return databaseError(error, "Décision non enregistrée");
  if (!data?.length) return { status: "error", message: "Cette page n’est plus en attente." };
  updateTag(BUSINESSES_CACHE_TAG);
  revalidatePath(href("adminPros"));
  redirect(href("adminPros", { query: { decision: parsed.data.decision === "publier" ? "publiee" : "refusee" } }));
}

export async function decideVerificationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ demande: z.uuid(), decision: z.enum(["verifier", "refuser"]), source: z.string().trim().max(200), note: z.string().trim().max(1000) })
    .safeParse({ demande: formData.get("demande"), decision: formData.get("decision"), source: read(formData, "source"), note: read(formData, "note") });
  if (!parsed.success) return { status: "error", message: "Décision invalide." };
  const account = await getCurrentAccount();
  if (!account || !isCurator(account.role)) return { status: "error", message: "Réservé à l’équipe locale." };
  const { supabase } = await session(href("adminPros"));
  const { error } = await supabase.rpc("decide_business_verification", {
    p_request: parsed.data.demande,
    p_approve: parsed.data.decision === "verifier",
    p_source_title: parsed.data.source,
    p_note: parsed.data.note || undefined,
  });
  if (error) return databaseError(error, "Décision non enregistrée");
  updateTag(BUSINESSES_CACHE_TAG);
  redirect(href("adminPros", { query: { decision: parsed.data.decision === "verifier" ? "verifiee" : "verification-refusee" } }));
}

export async function moderateReviewAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ avis: z.uuid(), decision: z.enum(["publier", "refuser"]) }).safeParse({ avis: formData.get("avis"), decision: formData.get("decision") });
  if (!parsed.success) return { status: "error", message: "Décision invalide." };
  const account = await getCurrentAccount();
  if (!account || !isStaff(account.role)) return { status: "error", message: "Réservé à l’équipe de modération." };
  const { supabase } = await session(href("adminReviews"));
  const { data, error } = await supabase
    .from("reviews")
    .update({ status: parsed.data.decision === "publier" ? "published" : "rejected" })
    .eq("id", parsed.data.avis)
    .eq("status", "pending")
    .select("id");
  if (error) return databaseError(error, "Décision non enregistrée");
  if (!data?.length) return { status: "error", message: "Cet avis n’est plus en attente." };
  updateTag(BUSINESSES_CACHE_TAG);
  redirect(href("adminReviews", { query: { decision: parsed.data.decision === "publier" ? "publie" : "refuse" } }));
}

// -----------------------------------------------------------------------------
// Espace professionnel : boîte de réception
// -----------------------------------------------------------------------------
const requestStatusSchema = z.object({ page: z.uuid(), demande: z.uuid(), statut: z.enum(["read", "replied", "archived", "new"]) });

/** Statut d'une demande reçue (gestionnaires de la page ; la base interdit de modifier son contenu). */
export async function updateRequestStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = requestStatusSchema.safeParse({ page: formData.get("page"), demande: formData.get("demande"), statut: formData.get("statut") });
  if (!parsed.success) return { status: "error", message: "Choix invalide." };
  const back = href("proInbox", { params: { id: parsed.data.page } });
  const { supabase } = await session(back);
  const { data, error } = await supabase.from("contact_requests").update({ status: parsed.data.statut }).eq("id", parsed.data.demande).eq("business_id", parsed.data.page).select("id");
  if (error) return databaseError(error, "Le statut n’a pas pu être enregistré");
  if (!data?.length) return { status: "error", message: "Demande introuvable ou réservée aux gestionnaires de la page." };
  revalidatePath(back);
  return { status: "success", message: "Statut enregistré." };
}
