"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { isStaff } from "@/domain/roles";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { slugify } from "@/modules/admin/domain/categories";
import { LISTINGS_CACHE_TAG } from "@/modules/listings/server/queries";
import { getCityContext } from "@/server/city-context";
import { getCurrentAccount, getSessionUser } from "@/server/auth";
import { APPLY_MODES, CONTRACTS, DOMAINS, EXPERIENCE, ORGANIZATIONS, REMOTE, safeApplyLink } from "../domain/attributes";
import { checkOffer } from "../domain/rules";
import { closedFeatureMessage, isFeatureEnabled } from "@/server/features";

const SHOWN_CODES = ["23514", "42501", "CP429"];
const keys = <T extends Record<string, string>>(table: T) => Object.keys(table) as [keyof T & string, ...(keyof T & string)[]];

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

async function signedIn(back: string) {
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  return supabase ? { user, supabase } : null;
}

function databaseError(error: { code: string; message: string }, fallback: string, formData?: FormData): FormState {
  if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message, values: formData ? formValues(formData) : undefined };
  logger.error(fallback, { module: "emploi", code: error.code });
  return { status: "error", message: `${fallback}. Réessayez.`, values: formData ? formValues(formData) : undefined };
}

// -----------------------------------------------------------------------------
// Candidater, retirer, décider
// -----------------------------------------------------------------------------
const applySchema = z.object({
  offre: z.uuid(),
  message: z.string().trim().min(20, "Présentez-vous en quelques lignes (20 caractères au moins).").max(5000, "5 000 caractères au maximum."),
});

/** Candidature interne : visible du seul employeur ; la base refuse une offre close, expirée ou externe. */
export async function applyAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("jobs"));
  const parsed = applySchema.safeParse({ offre: read(formData, "offre"), message: read(formData, "message") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const session = await signedIn(back);
  if (!session) return { status: "error", message: "Candidatures momentanément indisponibles.", values: formValues(formData) };
  const { error } = await session.supabase.from("job_applications").insert({ listing_id: parsed.data.offre, applicant_id: session.user.id, message: parsed.data.message });
  if (error) {
    if (error.code === "23505") return { status: "success", message: "Vous avez déjà candidaté à cette offre." };
    return databaseError(error, "La candidature n’a pas pu être envoyée", formData);
  }
  revalidatePath(back);
  return { status: "success", message: "Candidature envoyée. Seul l’employeur la voit ; suivez-la dans « Mes candidatures »." };
}

const statusSchema = z.object({ candidature: z.uuid(), statut: z.enum(["viewed", "shortlisted", "rejected", "withdrawn"]) });

/** Changement de statut : l'employeur décide (vue, retenue, non retenue), le candidat peut retirer. */
export async function setApplicationStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = statusSchema.safeParse({ candidature: read(formData, "candidature"), statut: read(formData, "statut") });
  if (!parsed.success) return { status: "error", message: "Statut invalide." };
  const session = await signedIn(href("myApplications"));
  if (!session) return { status: "error", message: "Service momentanément indisponible." };
  const { data, error } = await session.supabase.from("job_applications").update({ status: parsed.data.statut }).eq("id", parsed.data.candidature).select("id");
  if (error) return databaseError(error, "Le statut n’a pas pu être enregistré");
  if (!data?.length) return { status: "error", message: "Candidature introuvable." };
  revalidatePath(href("receivedApplications"));
  revalidatePath(href("myApplications"));
  return { status: "success", message: "Statut enregistré." };
}

// -----------------------------------------------------------------------------
// Profil candidat
// -----------------------------------------------------------------------------
const profileSchema = z.object({
  titre: z.string().trim().min(5, "5 caractères au moins.").max(120),
  resume: z.string().trim().max(2000).optional(),
  competences: z.string().max(1000).default(""),
  domaines: z.array(z.enum(keys(DOMAINS))).max(5).default([]),
  experience: z.enum(keys(EXPERIENCE)).optional(),
  disponible: z.literal("1").optional(),
  visibilite: z.enum(["private", "employers", "public"]),
  partage: z.literal("1").optional(),
  email: z.email("Adresse e-mail invalide.").optional(),
  telephone: z.string().trim().max(30).optional(),
});

/** Profil candidat : privé par défaut ; les coordonnées ne sont révélées qu'avec l'accord du candidat. */
export async function saveCandidateProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse({
    titre: read(formData, "titre"),
    resume: read(formData, "resume"),
    competences: formData.get("competences") ?? "",
    domaines: formData.getAll("domaines"),
    experience: read(formData, "experience"),
    disponible: read(formData, "disponible"),
    visibilite: read(formData, "visibilite") ?? "private",
    partage: read(formData, "partage"),
    email: read(formData, "email"),
    telephone: read(formData, "telephone"),
  });
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const data = parsed.data;
  if (data.partage && !data.email && !data.telephone) return { status: "error", fieldErrors: { email: "Indiquez une coordonnée à partager." }, values: formValues(formData) };
  const session = await signedIn(href("candidateProfile"));
  if (!session) return { status: "error", message: "Service momentanément indisponible." };
  const skills = [...new Set(data.competences.split(/[,\n]/).map((skill) => skill.trim()).filter((skill) => skill.length >= 2 && skill.length <= 60))].slice(0, 20);
  const { error } = await session.supabase.from("candidate_profiles").upsert({
    user_id: session.user.id,
    headline: data.titre,
    summary: data.resume ?? null,
    skills,
    domains: data.domaines,
    experience: data.experience ?? null,
    available: data.disponible === "1",
    visibility: data.visibilite,
    share_contact: data.partage === "1",
    contact_email: data.email ?? null,
    contact_phone: data.telephone ?? null,
  });
  if (error) return databaseError(error, "Le profil n’a pas pu être enregistré", formData);
  revalidatePath(href("candidateProfile"));
  return { status: "success", message: data.visibilite === "private" ? "Profil enregistré : il reste privé." : "Profil enregistré et visible selon votre choix." };
}

export async function deleteCandidateProfileAction(): Promise<FormState> {
  const session = await signedIn(href("candidateProfile"));
  if (!session) return { status: "error", message: "Service momentanément indisponible." };
  const { error } = await session.supabase.from("candidate_profiles").delete().eq("user_id", session.user.id);
  if (error) return databaseError(error, "Le profil n’a pas pu être supprimé");
  revalidatePath(href("candidateProfile"));
  return { status: "success", message: "Profil candidat supprimé." };
}

/** Coordonnées d'un candidat qui les partage, pour un compte employeur (règle en base). */
export async function revealCandidateContactAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("candidat"));
  if (!id.success) return { status: "error", message: "Profil introuvable." };
  const session = await signedIn(href("candidates"));
  if (!session) return { status: "error", message: "Service momentanément indisponible." };
  const { data, error } = await session.supabase.rpc("reveal_candidate_contact", { p_user: id.data });
  if (error) return databaseError(error, "Coordonnées indisponibles");
  const contact = z.array(z.object({ contact_email: z.string().nullable(), contact_phone: z.string().nullable() })).parse(data)[0];
  if (!contact) return { status: "error", message: "Ce candidat ne partage pas ses coordonnées." };
  return { status: "success", message: [contact.contact_email, contact.contact_phone].filter(Boolean).join(" · ") };
}

// -----------------------------------------------------------------------------
// Publier, clôturer, modérer une offre
// -----------------------------------------------------------------------------
const offerSchema = z
  .object({
    categorie: z.uuid({ error: "Choisissez le type d’annonce." }),
    titre: z.string().trim().min(5, "5 caractères au moins.").max(120, "120 caractères au maximum."),
    description: z.string().trim().min(20, "Décrivez l’offre (20 caractères au moins).").max(10000),
    contrat: z.enum(keys(CONTRACTS)).optional(),
    domaine: z.enum(keys(DOMAINS)).optional(),
    experience: z.enum(keys(EXPERIENCE)).optional(),
    teletravail: z.enum(keys(REMOTE)).optional(),
    organisation: z.enum(keys(ORGANIZATIONS), { error: "Indiquez le type d’organisation." }),
    date_limite: z.iso.date({ error: "Date invalide." }).optional(),
    candidature: z.enum(keys(APPLY_MODES)),
    lien: z.string().trim().optional(),
    quartier: z.uuid().optional(),
    contact: z.string().trim().max(80).optional(),
  })
  .refine((value) => value.candidature !== "externe" || safeApplyLink(value.lien), { message: "Indiquez un lien https vers la page de candidature.", path: ["lien"] });

/** Offre envoyée « en attente » : relue par la modération avant publication (règle en base). */
export async function publishJobAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!isFeatureEnabled("publishing")) return { status: "error", message: closedFeatureMessage("publishing") };
  const fields = ["categorie", "titre", "description", "contrat", "domaine", "experience", "teletravail", "organisation", "date_limite", "candidature", "lien", "quartier", "contact"] as const;
  const parsed = offerSchema.safeParse(Object.fromEntries(fields.map((name) => [name, read(formData, name)])));
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const data = parsed.data;
  const hits = checkOffer(`${data.titre}\n${data.description}`);
  if (hits.length > 0) {
    return {
      status: "error",
      message: `Formulation refusée — ${hits.map((hit) => `${hit.rule} (« ${hit.excerpt} ») : ${hit.advice}`).join(" ")}`,
      values: formValues(formData),
    };
  }
  if (data.date_limite && data.date_limite < new Date().toISOString().slice(0, 10)) {
    return { status: "error", fieldErrors: { date_limite: "La date limite est déjà passée." }, values: formValues(formData) };
  }
  const session = await signedIn(href("publishJob"));
  if (!session) return { status: "error", message: "Service momentanément indisponible.", values: formValues(formData) };
  const { current } = await getCityContext();
  if (!current.id) return { status: "error", message: "Service momentanément indisponible.", values: formValues(formData) };
  const attributes = Object.fromEntries(
    Object.entries({
      contrat: data.contrat,
      domaine: data.domaine,
      experience: data.experience,
      teletravail: data.teletravail,
      organisation: data.organisation,
      date_limite: data.date_limite,
      candidature: data.candidature,
      lien_candidature: data.candidature === "externe" ? safeApplyLink(data.lien)?.href : undefined,
    }).filter(([, value]) => value !== undefined),
  );
  // Au nom d'une page professionnelle : rattachée à la page et à son équipe (droit vérifié en base).
  const pageId = z.uuid().safeParse(formData.get("page"));
  const page = pageId.success ? (await session.supabase.from("business_profiles").select("id, organization_id").eq("id", pageId.data).maybeSingle()).data : null;
  const { error } = await session.supabase.from("listings").insert({
    owner_id: session.user.id,
    business_id: page?.id ?? null,
    organization_id: page?.organization_id ?? null,
    slug: `${slugify(data.titre).slice(0, 60) || "offre"}-${crypto.randomUUID().slice(0, 6)}`,
    title: data.titre,
    description: data.description,
    category_id: data.categorie,
    city_id: current.id,
    neighborhood_id: data.quartier ?? null,
    attributes,
    contact_name: data.contact ?? null,
    status: "pending",
  });
  if (error) return databaseError(error, "L’offre n’a pas pu être envoyée", formData);
  redirect(href("receivedApplications", { query: { publie: "1" } }));
}

/** Clôture d'une offre par son auteur : plus aucune candidature acceptée (règle en base). */
export async function closeJobAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("offre"));
  if (!id.success) return { status: "error", message: "Offre introuvable." };
  const session = await signedIn(href("receivedApplications"));
  if (!session) return { status: "error", message: "Service momentanément indisponible." };
  const { data, error } = await session.supabase.from("listings").update({ availability_status: "unavailable" }).eq("id", id.data).eq("owner_id", session.user.id).select("id");
  if (error) return databaseError(error, "L’offre n’a pas pu être clôturée");
  if (!data?.length) return { status: "error", message: "Offre introuvable." };
  updateTag(LISTINGS_CACHE_TAG);
  revalidatePath(href("receivedApplications"));
  return { status: "success", message: "Offre clôturée : elle n’accepte plus de candidature." };
}

const moderationSchema = z
  .object({ offre: z.uuid(), decision: z.enum(["publier", "refuser"]), motif: z.string().trim().max(500).optional() })
  .refine((value) => value.decision === "publier" || (value.motif?.length ?? 0) >= 5, { message: "Motivez le refus (5 caractères au moins).", path: ["motif"] });

/** Décision de modération (équipe) ; l'auteur est notifié par la base. */
export async function moderateJobAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = moderationSchema.safeParse({ offre: read(formData, "offre"), decision: read(formData, "decision"), motif: read(formData, "motif") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const account = await getCurrentAccount();
  if (!account || !isStaff(account.role)) return { status: "error", message: "Décision réservée à l’équipe de modération." };
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };
  const publish = parsed.data.decision === "publier";
  const { data, error } = await supabase
    .from("listings")
    .update(publish ? { status: "published" } : { status: "rejected", rejection_reason: parsed.data.motif })
    .eq("id", parsed.data.offre)
    .eq("status", "pending")
    .select("id");
  if (error) return databaseError(error, "La décision n’a pas pu être enregistrée");
  if (!data?.length) return { status: "error", message: "Décision impossible (déjà traitée ?)." };
  updateTag(LISTINGS_CACHE_TAG);
  redirect(href("adminJobs", { query: { decision: publish ? "publie" : "refuse" } }));
}
