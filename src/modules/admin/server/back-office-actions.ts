"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { USER_ROLES, type Actor } from "@/domain/roles";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { BUSINESSES_CACHE_TAG } from "@/modules/businesses/server/queries";
import { EVENTS_CACHE_TAG } from "@/modules/events/server/queries";
import { LISTINGS_CACHE_TAG } from "@/modules/listings/server/queries";
import { PLACES_CACHE_TAG } from "@/modules/places/server/queries";
import { getCurrentAccount } from "@/server/auth";
import { CAMPAIGN_DECISIONS, REPORT_DECISIONS, canAccess, type Audience, type CampaignDecision } from "../domain/back-office";

/**
 * Décisions du back-office. Chacune passe par une fonction SQL qui vérifie le
 * rôle, exige une raison et journalise l'auteur, la date, l'avant et l'après.
 */

const SHOWN_CODES = ["23514", "42501", "22023", "P0002", "23505"];

async function teamClient(audience: Audience) {
  const account = await getCurrentAccount();
  if (!account || !canAccess(account.role as Actor, audience)) return null;
  return createSessionSupabaseClient();
}

function databaseError(error: { code: string; message: string }, fallback: string, formData: FormData): FormState {
  if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
  logger.error(fallback, { module: "administration", code: error.code });
  return { status: "error", message: `${fallback}. Réessayez.`, values: formValues(formData) };
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const reason = z.string().trim().min(5, "Indiquez la raison (5 caractères au moins).").max(1000, "1 000 caractères au maximum.");
const DENIED: FormState = { status: "error", message: "Action réservée à l’équipe habilitée." };

// -----------------------------------------------------------------------------
// Signalements
// -----------------------------------------------------------------------------
export async function handleReportAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ signalement: z.uuid(), decision: z.enum(REPORT_DECISIONS), note: z.string().max(1000, "1 000 caractères au maximum.") })
    .safeParse({ signalement: formData.get("signalement"), decision: formData.get("decision"), note: text(formData, "note") });
  if (!parsed.success) return { status: "error", message: "Décision invalide.", values: formValues(formData) };
  const { signalement, decision, note } = parsed.data;
  if ((decision === "suspendre" || decision === "sans_suite") && note.length < 5) {
    return { status: "error", fieldErrors: { note: "Indiquez la raison (5 caractères au moins) : elle est transmise à l’auteur en cas de suspension." }, values: formValues(formData) };
  }
  const supabase = await teamClient("staff");
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("handle_report", { p_report: signalement, p_decision: decision, p_note: note || undefined });
  if (error) return databaseError(error, "Décision non enregistrée", formData);
  if (decision === "suspendre") {
    for (const tag of [LISTINGS_CACHE_TAG, PLACES_CACHE_TAG, EVENTS_CACHE_TAG, BUSINESSES_CACHE_TAG]) updateTag(tag);
  }
  revalidatePath(href("adminReports"));
  redirect(href("adminReports", { query: { decision } }));
}

// -----------------------------------------------------------------------------
// Comptes et organisations
// -----------------------------------------------------------------------------
const accountSchema = z.object({
  compte: z.uuid(),
  role: z.enum(USER_ROLES).optional(),
  suspension: z.enum(["suspendre", "lever"]).optional(),
  raison: reason,
});

export async function setAccountAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = accountSchema.safeParse({
    compte: formData.get("compte"),
    role: text(formData, "role") || undefined,
    suspension: text(formData, "suspension") || undefined,
    raison: text(formData, "raison"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const { compte, role, suspension, raison } = parsed.data;
  if (!role && !suspension) return { status: "error", message: "Choisissez un rôle ou une sanction.", values: formValues(formData) };
  const supabase = await teamClient("admin");
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("admin_set_account", {
    p_user: compte,
    p_role: role,
    p_suspended: suspension ? suspension === "suspendre" : undefined,
    p_reason: raison,
  });
  if (error) return databaseError(error, "Décision non enregistrée", formData);
  revalidatePath(href("adminAccounts"));
  return { status: "success", message: "Décision enregistrée et journalisée." };
}

/**
 * Second facteur perdu (téléphone changé) : un superadministrateur — lui-même
 * connecté avec son second facteur — supprime les facteurs d'un compte de
 * l'équipe, qui en configurera un nouveau à sa prochaine connexion. Raison
 * obligatoire, décision journalisée.
 */
export async function resetSecondFactorAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ compte: z.uuid(), raison: reason }).safeParse({ compte: formData.get("compte"), raison: text(formData, "raison") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const account = await getCurrentAccount();
  // Rôle effectif : un superadministrateur sans second facteur n'est pas habilité.
  if (!account || account.role !== "superadmin") return DENIED;
  if (parsed.data.compte === account.id) return { status: "error", message: "Votre propre second facteur ne se réinitialise pas d’ici." };
  const admin = createAdminSupabaseClient();
  if (!admin) return { status: "error", message: "Clé secrète du serveur absente : réinitialisation impossible." };
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: parsed.data.compte });
  if (error) return databaseError({ code: error.code ?? "", message: error.message }, "Second facteur non réinitialisé", formData);
  for (const factor of data.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ userId: parsed.data.compte, id: factor.id });
    if (deleteError) return databaseError({ code: deleteError.code ?? "", message: deleteError.message }, "Second facteur non réinitialisé", formData);
  }
  await admin.from("admin_audit_log").insert({
    actor_id: account.id,
    action: "compte.second_facteur_reinitialise",
    entity_type: "profiles",
    entity_id: parsed.data.compte,
    details: { raison: parsed.data.raison, facteurs: data.factors.length, avant: "configuré", apres: "à configurer" },
  });
  return { status: "success", message: data.factors.length ? "Second facteur réinitialisé : le compte en configurera un nouveau à sa prochaine connexion." : "Ce compte n’avait aucun second facteur." };
}

export async function setOrganizationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ organisation: z.uuid(), suspension: z.enum(["suspendre", "lever"]), raison: reason })
    .safeParse({ organisation: formData.get("organisation"), suspension: formData.get("suspension"), raison: text(formData, "raison") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const supabase = await teamClient("admin");
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("admin_set_organization", {
    p_organization: parsed.data.organisation,
    p_suspended: parsed.data.suspension === "suspendre",
    p_reason: parsed.data.raison,
  });
  if (error) return databaseError(error, "Décision non enregistrée", formData);
  revalidatePath(href("adminAccounts"));
  return { status: "success", message: "Décision enregistrée et journalisée." };
}

// -----------------------------------------------------------------------------
// Doublons et sources (équipe locale)
// -----------------------------------------------------------------------------
export async function mergePlacesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  // La paire (a, b) est fixée par la page ; la personne choisit laquelle conserver.
  const pair = [text(formData, "a"), text(formData, "b")];
  const kept = text(formData, "conserver");
  const parsed = z
    .object({ conserver: z.uuid("Choisissez la fiche à conserver."), doublon: z.uuid("Choisissez la fiche à conserver."), raison: reason })
    .safeParse({ conserver: pair.includes(kept) ? kept : "", doublon: pair.find((id) => id !== kept) ?? "", raison: text(formData, "raison") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const supabase = await teamClient("curator");
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("merge_places", { p_keep: parsed.data.conserver, p_duplicate: parsed.data.doublon, p_reason: parsed.data.raison });
  if (error) return databaseError(error, "Fusion non effectuée", formData);
  updateTag(PLACES_CACHE_TAG);
  revalidatePath(href("adminDuplicates"));
  redirect(href("adminDuplicates", { query: { fusion: "ok" } }));
}

const SOURCE_KINDS = ["terrain", "officiel", "partenaire", "declaratif", "publication", "autre"] as const;
const sourceSchema = z.object({
  type: z.enum(SOURCE_KINDS, { error: "Choisissez un type." }),
  titre: z.string().trim().min(3, "3 caractères au moins.").max(200, "200 caractères au maximum."),
  editeur: z.string().trim().max(200, "200 caractères au maximum."),
  url: z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "Adresse web invalide (http ou https)." })]),
  date: z.iso.date("Date invalide."),
});

export async function createSourceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = sourceSchema.safeParse({
    type: formData.get("type"),
    titre: text(formData, "titre"),
    editeur: text(formData, "editeur"),
    url: text(formData, "url"),
    date: text(formData, "date"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  if (parsed.data.date > new Date().toISOString().slice(0, 10)) return { status: "error", fieldErrors: { date: "La date de collecte ne peut pas être future." }, values: formValues(formData) };
  const account = await getCurrentAccount();
  const supabase = await teamClient("curator");
  if (!supabase || !account) return DENIED;
  const { error } = await supabase.from("sources").insert({
    kind: parsed.data.type,
    title: parsed.data.titre,
    publisher: parsed.data.editeur || null,
    url: parsed.data.url || null,
    collected_at: parsed.data.date,
    created_by: account.id,
  });
  if (error) return databaseError(error, "Source non enregistrée", formData);
  revalidatePath(href("adminSources"));
  return { status: "success", message: "Source enregistrée : elle peut désormais justifier une vérification." };
}

// -----------------------------------------------------------------------------
// Mises en avant
// -----------------------------------------------------------------------------
export async function setCampaignStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ campagne: z.uuid(), statut: z.enum(Object.keys(CAMPAIGN_DECISIONS) as [CampaignDecision, ...CampaignDecision[]]), raison: reason })
    .safeParse({ campagne: formData.get("campagne"), statut: formData.get("statut"), raison: text(formData, "raison") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const supabase = await teamClient("admin");
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("admin_set_campaign_status", { p_campaign: parsed.data.campagne, p_status: parsed.data.statut, p_reason: parsed.data.raison });
  if (error) return databaseError(error, "Décision non enregistrée", formData);
  revalidatePath(href("adminPromotions"));
  return { status: "success", message: "Décision enregistrée et journalisée." };
}

// -----------------------------------------------------------------------------
// Intelligence artificielle
// -----------------------------------------------------------------------------
export async function setAiKillSwitchAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ etat: z.enum(["couper", "reactiver"]), raison: reason })
    .safeParse({ etat: formData.get("etat"), raison: text(formData, "raison") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const supabase = await teamClient("admin");
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("set_ai_kill_switch", { p_disabled: parsed.data.etat === "couper", p_reason: parsed.data.raison });
  if (error) return databaseError(error, "Décision non enregistrée", formData);
  revalidatePath(href("adminAi"));
  return { status: "success", message: parsed.data.etat === "couper" ? "IA coupée partout : le site fonctionne sans elle." : "IA réactivée (selon les fonctions activées)." };
}
