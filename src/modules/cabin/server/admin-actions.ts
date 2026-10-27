"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getCurrentAccount } from "@/server/auth";
import { CABIN_SERVICES, CABIN_STATUSES } from "../domain/cabin";
import { liveAdapter } from "./providers";

/*
 * Administration de la cabine. Contrôle d'interface (rôle effectif :
 * administrateur avec second facteur) ; la base applique les mêmes règles
 * (écriture réservée à is_admin(), rapprochement journalisé).
 */

const DENIED: FormState = { status: "error", message: "Action réservée aux administrateurs." };
const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

async function adminClient() {
  const account = await getCurrentAccount();
  if (!account || !isAdmin(account.role)) return null;
  const supabase = await createSessionSupabaseClient();
  return supabase ? { supabase, account } : null;
}

function done(message: string): FormState {
  revalidatePath(href("adminCabin"));
  revalidatePath(href("cabin"));
  return { status: "success", message };
}

function failure(error: { code?: string; message: string }, fallback: string): FormState {
  if (["23514", "23503", "42501", "P0002"].includes(error.code ?? "")) return { status: "error", message: error.message };
  logger.error(fallback, { module: "cabine", code: error.code });
  return { status: "error", message: `${fallback}. Réessayez.` };
}

const serviceSchema = z
  .object({
    service: z.enum(CABIN_SERVICES),
    taux: z.coerce.number({ error: "Taux attendu." }).min(0, "Taux positif.").max(10, "10 % au maximum."),
    minimum: z.coerce.number().int().positive("Minimum positif."),
    maximum: z.coerce.number().int().positive("Maximum positif."),
    prestataire: z.string().max(40),
    actif: z.literal("1").optional(),
  })
  .refine((data) => data.maximum >= data.minimum, { path: ["maximum"], message: "Le maximum doit dépasser le minimum." });

/** Service : activation, taux de frais (en %, stocké en points de base), limites, prestataire. */
export async function updateCabinServiceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = serviceSchema.safeParse({
    service: text(formData, "service"),
    taux: text(formData, "taux").replace(",", "."),
    minimum: text(formData, "minimum"),
    maximum: text(formData, "maximum"),
    prestataire: text(formData, "prestataire"),
    actif: text(formData, "actif") || undefined,
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const context = await adminClient();
  if (!context) return DENIED;
  const { service, taux, minimum, maximum, prestataire, actif } = parsed.data;
  const { error } = await context.supabase
    .from("cabin_service_settings")
    .update({
      fee_bps: Math.round(taux * 100),
      min_amount_xof: minimum,
      max_amount_xof: maximum,
      provider_code: prestataire || null,
      is_enabled: actif === "1",
      updated_by: context.account.id,
      updated_at: new Date().toISOString(),
    })
    .eq("service", service);
  if (error) return failure(error, "Service non enregistré");
  return done("Service enregistré : la cabine applique aussitôt ces réglages (un récapitulatif déjà affiché devra être reconfirmé).");
}

const providerSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]{2,40}$/, "Identifiant : minuscules, chiffres et _ (2 à 40)."),
  nom: z.string().trim().min(2).max(80),
  description: z.string().max(500).optional(),
  mode: z.enum(["demo", "live"]),
  actif: z.literal("1").optional(),
});

/** Prestataire : création ou modification, activation et suspension, mode réel seulement si son intégration existe. */
export async function saveCabinProviderAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = providerSchema.safeParse({
    code: text(formData, "code"),
    nom: text(formData, "nom"),
    description: text(formData, "description") || undefined,
    mode: text(formData, "mode") || "demo",
    actif: text(formData, "actif") || undefined,
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const services = formData.getAll("services").filter((value): value is (typeof CABIN_SERVICES)[number] => CABIN_SERVICES.includes(value as never));
  if (parsed.data.mode === "live" && !liveAdapter(parsed.data.code)) {
    return {
      status: "error",
      message: "Mode réel impossible : aucune intégration de ce prestataire n’est installée ou ses clés ne sont pas configurées sur le serveur. Il reste en démonstration.",
      values: formValues(formData),
    };
  }
  const context = await adminClient();
  if (!context) return DENIED;
  const { error } = await context.supabase.from("cabin_providers").upsert({
    code: parsed.data.code,
    name: parsed.data.nom,
    description: parsed.data.description ?? null,
    services,
    mode: parsed.data.mode,
    is_active: parsed.data.actif === "1",
    updated_by: context.account.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return failure(error, "Prestataire non enregistré");
  return done(parsed.data.actif === "1" ? "Prestataire enregistré et actif." : "Prestataire enregistré, suspendu.");
}

/** Réseau : activation ou suspension. */
export async function toggleCabinNetworkAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const code = text(formData, "reseau");
  const active = text(formData, "actif") === "1";
  if (!/^[a-z0-9_]{2,40}$/.test(code)) return { status: "error", message: "Réseau inconnu." };
  const context = await adminClient();
  if (!context) return DENIED;
  const { error } = await context.supabase.from("cabin_networks").update({ is_active: active }).eq("code", code);
  if (error) return failure(error, "Réseau non enregistré");
  return done(active ? "Réseau réactivé." : "Réseau suspendu.");
}

/** Combinaison de transfert : activée seulement avec un prestataire qui la prend en charge (règle en base). */
export async function updateCabinRouteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const source = text(formData, "source");
  const target = text(formData, "cible");
  const provider = text(formData, "prestataire");
  const enabled = text(formData, "actif") === "1";
  if (enabled && !provider) return { status: "error", message: "Choisissez le prestataire qui prend en charge cette combinaison avant de l’activer." };
  const context = await adminClient();
  if (!context) return DENIED;
  const { error } = await context.supabase
    .from("cabin_transfer_routes")
    .update({
      provider_code: provider || null,
      is_enabled: enabled,
      note: enabled ? null : "Aucun prestataire connecté ne prend en charge cette combinaison.",
      updated_at: new Date().toISOString(),
    })
    .eq("source_code", source)
    .eq("target_code", target);
  if (error) return failure(error, "Combinaison non enregistrée");
  return done(enabled ? "Combinaison activée." : "Combinaison désactivée.");
}

const offerSchema = z.object({
  reseau: z.string().regex(/^[a-z0-9_]{2,40}$/),
  nom: z.string().trim().min(2, "Nom trop court.").max(120),
  prix: z.coerce.number({ error: "Prix attendu." }).int("Prix entier en F CFA.").positive("Prix positif."),
  volume: z.string().trim().max(40).optional(),
  validite: z.string().trim().max(40).optional(),
  source: z.string().trim().min(3, "Indiquez l’origine du tarif (catalogue du prestataire, grille officielle…).").max(300),
});

/** Offre Internet du catalogue : toujours avec son origine (jamais de tarif inventé). */
export async function createCabinOfferAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = offerSchema.safeParse({
    reseau: text(formData, "reseau"),
    nom: text(formData, "nom"),
    prix: text(formData, "prix").replace(/\s/g, ""),
    volume: text(formData, "volume") || undefined,
    validite: text(formData, "validite") || undefined,
    source: text(formData, "source"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const context = await adminClient();
  if (!context) return DENIED;
  const { error } = await context.supabase.from("cabin_offers").insert({
    network_code: parsed.data.reseau,
    name: parsed.data.nom,
    price_xof: parsed.data.prix,
    data_volume: parsed.data.volume ?? null,
    validity: parsed.data.validite ?? null,
    source: parsed.data.source,
    created_by: context.account.id,
  });
  if (error) return failure(error, "Offre non enregistrée");
  return done("Offre ajoutée au catalogue.");
}

export async function toggleCabinOfferAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(text(formData, "offre"));
  if (!id.success) return { status: "error", message: "Offre inconnue." };
  const context = await adminClient();
  if (!context) return DENIED;
  const active = text(formData, "actif") === "1";
  const { error } = await context.supabase.from("cabin_offers").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id.data);
  if (error) return failure(error, "Offre non enregistrée");
  return done(active ? "Offre réactivée." : "Offre retirée du catalogue.");
}

const reconcileSchema = z.object({
  operation: z.uuid(),
  etat: z.enum(CABIN_STATUSES),
  raison: z.string().trim().min(5, "Indiquez la raison (relevé du prestataire, réclamation…), 5 caractères au moins.").max(500),
  reference: z.string().trim().max(120).optional(),
});

/** Rapprochement : état constaté chez le prestataire, raison obligatoire, journalisé (fonction SQL). */
export async function reconcileCabinOperationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = reconcileSchema.safeParse({
    operation: text(formData, "operation"),
    etat: text(formData, "etat"),
    raison: text(formData, "raison"),
    reference: text(formData, "reference") || undefined,
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const context = await adminClient();
  if (!context) return DENIED;
  const { error } = await context.supabase.rpc("set_cabin_status", {
    p_operation: parsed.data.operation,
    p_status: parsed.data.etat,
    p_source: "administration",
    p_detail: parsed.data.raison,
    p_provider_reference: (parsed.data.reference ?? null) as string,
  });
  if (error) return failure(error, "Rapprochement non enregistré");
  return done("Rapprochement enregistré et journalisé.");
}
