"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { href } from "@/config/routes";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { NEIGHBORHOODS_CACHE_TAG } from "./queries";

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

/** Messages de la base (contrôles des périmètres, droits) affichés tels quels. */
const SHOWN_CODES = ["23514", "42501", "CP429"];

function refresh(slug: string) {
  updateTag(NEIGHBORHOODS_CACHE_TAG);
  revalidatePath(href("adminNeighborhood", { params: { slug } }));
}

const fiche = z
  .object({
    quartier: z.uuid(),
    slug: z.string(),
    nom: z.string().trim().min(2, "2 caractères au moins.").max(80, "80 caractères au maximum."),
    autres_noms: z.string().max(800).default(""),
    description: z.string().trim().max(2000, "2 000 caractères au maximum.").optional(),
    verification: z.enum(["pending_validation", "verified", "placeholder", "archived"]),
    source: z.uuid().optional(),
    actif: z.literal("1").optional(),
    responsable: z.literal("1").optional(),
    note: z.string().trim().min(3, "Décrivez la modification (3 caractères au moins).").max(300),
  })
  .refine((value) => value.verification !== "verified" || value.source, { message: "Un quartier vérifié cite sa source.", path: ["source"] });

/** Fiche d'un quartier : chaque modification est historisée avec sa note (règles en base). */
export async function saveNeighborhoodAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = fiche.safeParse({
    quartier: read(formData, "quartier"),
    slug: read(formData, "slug"),
    nom: read(formData, "nom"),
    autres_noms: formData.get("autres_noms") ?? "",
    description: read(formData, "description"),
    verification: read(formData, "verification"),
    source: read(formData, "source"),
    actif: read(formData, "actif"),
    responsable: read(formData, "responsable"),
    note: read(formData, "note"),
  });
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const data = parsed.data;
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };
  const altNames = [...new Set(data.autres_noms.split(/[,\n]/).map((name) => name.trim()).filter((name) => name.length >= 2 && name.length <= 80))].slice(0, 10);
  // p_source et p_description acceptent null : les types générés ne le disent pas.
  const args = {
    p_id: data.quartier,
    p_name: data.nom,
    p_alt_names: altNames,
    p_description: data.description ?? null,
    p_verification: data.verification,
    p_source: data.source ?? null,
    p_is_active: data.actif === "1",
    p_make_me_steward: data.responsable === "1",
    p_change_note: data.note,
  } as unknown as Database["public"]["Functions"]["save_neighborhood"]["Args"];
  const { error } = await supabase.rpc("save_neighborhood", args);
  if (error) {
    if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Quartier non enregistré", { module: "quartiers", code: error.code });
    return { status: "error", message: "La fiche n’a pas pu être enregistrée.", values: formValues(formData) };
  }
  refresh(data.slug);
  return { status: "success", message: "Fiche enregistrée ; la modification est historisée avec votre note." };
}

const proposal = z.object({
  quartier: z.uuid(),
  slug: z.string(),
  geojson: z.string().trim().min(20, "Collez un GeoJSON (Polygon ou MultiPolygon).").max(500_000, "GeoJSON trop volumineux."),
  source: z.uuid().optional(),
  note: z.string().trim().max(1000).optional(),
});

/** Brouillon de périmètre : contrôlé par la base, sans effet tant qu'il n'est pas validé. */
export async function proposeBoundaryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = proposal.safeParse({
    quartier: read(formData, "quartier"),
    slug: read(formData, "slug"),
    geojson: read(formData, "geojson"),
    source: read(formData, "source"),
    note: read(formData, "note"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };
  const args = {
    p_neighborhood: parsed.data.quartier,
    p_geojson: parsed.data.geojson,
    p_source: parsed.data.source ?? null,
    p_note: parsed.data.note ?? null,
  } as unknown as Database["public"]["Functions"]["propose_neighborhood_boundary"]["Args"];
  const { error } = await supabase.rpc("propose_neighborhood_boundary", args);
  if (error) {
    if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Brouillon de périmètre refusé", { module: "quartiers", code: error.code });
    return { status: "error", message: "Le brouillon n’a pas pu être enregistré.", values: formValues(formData) };
  }
  refresh(parsed.data.slug);
  return { status: "success", message: "Brouillon enregistré : il sera publié une fois validé." };
}

const review = z.object({
  brouillon: z.uuid(),
  slug: z.string(),
  decision: z.enum(["valider", "refuser"]),
  note: z.string().trim().max(1000).optional(),
});

export async function reviewBoundaryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = review.safeParse({ brouillon: read(formData, "brouillon"), slug: read(formData, "slug"), decision: read(formData, "decision"), note: read(formData, "note") });
  if (!parsed.success) return { status: "error", message: "Décision invalide." };
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };
  const approve = parsed.data.decision === "valider";
  const args = { p_boundary: parsed.data.brouillon, p_approve: approve, p_note: parsed.data.note ?? null } as unknown as Database["public"]["Functions"]["review_neighborhood_boundary"]["Args"];
  const { error } = await supabase.rpc("review_neighborhood_boundary", args);
  if (error) {
    if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message };
    logger.error("Décision de périmètre non enregistrée", { module: "quartiers", code: error.code });
    return { status: "error", message: "La décision n’a pas pu être enregistrée." };
  }
  refresh(parsed.data.slug);
  return { status: "success", message: approve ? "Périmètre validé et publié." : "Brouillon refusé." };
}

const clearing = z.object({ quartier: z.uuid(), slug: z.string(), note: z.string().trim().min(5, "Motivez le retrait (5 caractères au moins).").max(1000) });

export async function clearBoundaryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = clearing.safeParse({ quartier: read(formData, "quartier"), slug: read(formData, "slug"), note: read(formData, "note") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };
  const { error } = await supabase.rpc("clear_neighborhood_boundary", { p_neighborhood: parsed.data.quartier, p_note: parsed.data.note });
  if (error) {
    if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message };
    logger.error("Retrait de périmètre non enregistré", { module: "quartiers", code: error.code });
    return { status: "error", message: "Le retrait n’a pas pu être enregistré." };
  }
  refresh(parsed.data.slug);
  return { status: "success", message: "Périmètre retiré : le quartier reste sans carte jusqu’à une nouvelle validation." };
}
