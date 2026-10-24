"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { BUSINESSES_CACHE_TAG } from "@/modules/businesses/server/queries";
import { EVENTS_CACHE_TAG } from "@/modules/events/server/queries";
import { ATTRIBUTE_SCHEMAS } from "@/modules/listings/domain/attributes";
import { LISTINGS_CACHE_TAG } from "@/modules/listings/server/queries";
import { PLACES_CACHE_TAG } from "@/modules/places/server/queries";
import { getCurrentAccount } from "@/server/auth";
import { CATEGORIES_CACHE_TAG } from "@/server/repositories/categories";
import { CATEGORY_FAMILY_LABELS, parseKeywords, slugify, type CategoryFamily } from "../domain/categories";

/** Types de contenus d'une nouvelle rubrique principale, selon sa famille. */
const FAMILY_CONTENT_TYPES: Record<CategoryFamily, ("listing" | "place" | "event" | "business")[]> = {
  trouver: ["listing"],
  decouvrir: ["place", "event"],
  entreprendre: ["business", "place", "listing"],
};

const optionalText = (max: number) => z.string().trim().max(max, `${max} caractères au maximum.`).optional();
const schemaField = z
  .string()
  .optional()
  .refine((value) => !value || Object.hasOwn(ATTRIBUTE_SCHEMAS, value), "Modèle de fiche inconnu.");

const common = {
  nom: z.string().trim().min(2, "2 caractères au moins.").max(80, "80 caractères au maximum."),
  description: optionalText(300),
  mots_cles: z.string().max(2000, "Liste trop longue.").default(""),
  ordre: z.coerce.number({ error: "Nombre attendu." }).int("Nombre entier attendu.").min(-1000).max(100000),
  icone: z.string().trim().max(40).optional(),
  schema: schemaField,
};

const updateSchema = z.object({
  categorie: z.uuid(),
  ...common,
  parent: z.uuid().optional(),
  active: z.literal("1").optional(),
});
const createSchema = z.object({
  parent: z.uuid().optional(),
  famille: z.enum(Object.keys(CATEGORY_FAMILY_LABELS) as [CategoryFamily, ...CategoryFamily[]]).optional(),
  ...common,
  slug: optionalText(60),
});
const deleteSchema = z.object({
  categorie: z.uuid(),
  reprise: z.uuid().optional(),
  raison: z.string().trim().min(5, "5 caractères au moins.").max(500, "500 caractères au maximum."),
});

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

/** Contrôle d'interface ; la base refuse de toute façon toute écriture à un non-administrateur. */
async function adminClient() {
  const account = await getCurrentAccount();
  if (!account || !isAdmin(account.role)) return null;
  return createSessionSupabaseClient();
}

function refresh(contents = false) {
  updateTag(CATEGORIES_CACHE_TAG);
  // Contenus déplacés ou renommés : les cartes publiques affichent le nom de leur catégorie.
  if (contents) for (const tag of [LISTINGS_CACHE_TAG, PLACES_CACHE_TAG, EVENTS_CACHE_TAG, BUSINESSES_CACHE_TAG]) updateTag(tag);
  revalidatePath(href("adminCategories"));
}

/** Messages de la base sur l'arborescence (cycle, quatre niveaux, famille) : rédigés pour l'administration. */
function treeError(error: { code?: string; message: string }): string | null {
  return error.code === "23514" && !error.message.startsWith("new row") ? error.message : null;
}

/**
 * Champs actifs : uniquement ceux du modèle conservé ; tous cochés (ou modèle
 * changé dans le même envoi) équivaut à « tous » (null).
 */
function activeFields(formData: FormData, schema: string | null, previousSchema: string | null): string[] | null {
  const definitions = schema ? ATTRIBUTE_SCHEMAS[schema] : undefined;
  if (!definitions || schema !== previousSchema) return null;
  const keys = Object.keys(definitions);
  const checked = formData.getAll("champs").filter((value): value is string => typeof value === "string" && keys.includes(value));
  return checked.length === keys.length ? null : checked;
}

export async function updateCategoryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = updateSchema.safeParse({
    categorie: read(formData, "categorie"),
    nom: read(formData, "nom"),
    description: read(formData, "description"),
    mots_cles: formData.get("mots_cles") ?? "",
    ordre: read(formData, "ordre"),
    icone: read(formData, "icone"),
    schema: read(formData, "schema"),
    parent: read(formData, "parent"),
    active: read(formData, "active"),
  });
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const supabase = await adminClient();
  if (!supabase) return { status: "error", message: "Action réservée aux administrateurs." };

  const { categorie, nom, description, mots_cles, ordre, icone, schema, parent, active } = parsed.data;
  const { data: current } = await supabase.from("categories").select("parent_id, attribute_schema").eq("id", categorie).maybeSingle();
  if (!current) return { status: "error", message: "Catégorie introuvable." };
  const nextSchema = schema ?? null;
  const { data, error } = await supabase
    .from("categories")
    .update({
      name: nom,
      description: description ?? null,
      keywords: parseKeywords(mots_cles),
      sort_order: ordre,
      icon: icone ?? null,
      attribute_schema: nextSchema,
      attribute_fields: activeFields(formData, nextSchema, current.attribute_schema),
      parent_id: parent ?? null,
      is_active: active === "1",
    })
    .eq("id", categorie)
    .select("id");
  if (error || !data?.length) {
    const message = error ? treeError(error) : null;
    if (error && !message) logger.error("Catégorie non modifiée", { module: "admin", code: error.code });
    return { status: "error", message: message ?? "La catégorie n’a pas pu être enregistrée.", values: formValues(formData) };
  }
  refresh(true);
  const moved = (parent ?? null) !== current.parent_id;
  return { status: "success", message: moved ? "Enregistré et déplacée. Les contenus rattachés la suivent." : "Enregistré. Les pages publiques utilisent déjà la nouvelle version." };
}

export async function createCategoryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = createSchema.safeParse({
    parent: read(formData, "parent"),
    famille: read(formData, "famille"),
    nom: read(formData, "nom"),
    description: read(formData, "description"),
    slug: read(formData, "slug"),
    mots_cles: formData.get("mots_cles") ?? "",
    ordre: read(formData, "ordre") ?? "100",
    icone: read(formData, "icone"),
    schema: read(formData, "schema"),
  });
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const slug = slugify(parsed.data.slug ?? parsed.data.nom);
  if (!slug) return { status: "error", message: "Vérifiez les champs.", fieldErrors: { slug: "Identifiant invalide." }, values: formValues(formData) };
  const supabase = await adminClient();
  if (!supabase) return { status: "error", message: "Action réservée aux administrateurs." };

  // Une sous-catégorie hérite de la famille, des types de contenus, du modèle de fiche et des champs actifs du parent.
  let inherited: { family: CategoryFamily; content_types: ("listing" | "place" | "event" | "business")[]; attribute_schema: string | null; attribute_fields: string[] | null };
  if (parsed.data.parent) {
    const { data: parent } = await supabase
      .from("categories")
      .select("family, content_types, attribute_schema, attribute_fields")
      .eq("id", parsed.data.parent)
      .maybeSingle();
    if (!parent) return { status: "error", message: "Catégorie parente introuvable." };
    inherited = { ...parent, attribute_schema: parsed.data.schema ?? parent.attribute_schema };
  } else if (parsed.data.famille) {
    inherited = { family: parsed.data.famille, content_types: FAMILY_CONTENT_TYPES[parsed.data.famille], attribute_schema: parsed.data.schema ?? null, attribute_fields: null };
  } else {
    return { status: "error", message: "Indiquez la rubrique parente ou la famille." };
  }

  const { error } = await supabase.from("categories").insert({
    parent_id: parsed.data.parent ?? null,
    family: inherited.family,
    content_types: inherited.content_types,
    attribute_schema: inherited.attribute_schema,
    attribute_fields: inherited.attribute_fields,
    slug,
    name: parsed.data.nom,
    description: parsed.data.description ?? null,
    icon: parsed.data.icone ?? null,
    keywords: parseKeywords(parsed.data.mots_cles),
    sort_order: parsed.data.ordre,
  });
  if (error) {
    if (error.code === "23505") return { status: "error", message: "Vérifiez les champs.", fieldErrors: { slug: `L’identifiant « ${slug} » existe déjà.` }, values: formValues(formData) };
    const message = treeError(error);
    if (!message) logger.error("Catégorie non créée", { module: "admin", code: error.code });
    return { status: "error", message: message ?? "La catégorie n’a pas pu être créée.", values: formValues(formData) };
  }
  refresh();
  return { status: "success", message: `« ${parsed.data.nom} » ajoutée (adresse : ${slug}).` };
}

/** Suppression définitive : sans sous-catégorie, contenus repris par une autre catégorie (vérifié et journalisé par la base). */
export async function deleteCategoryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = deleteSchema.safeParse({ categorie: read(formData, "categorie"), reprise: read(formData, "reprise"), raison: read(formData, "raison") });
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const supabase = await adminClient();
  if (!supabase) return { status: "error", message: "Action réservée aux administrateurs." };
  const { categorie, reprise, raison } = parsed.data;
  // null : aucun contenu à reprendre (la base refuse si la catégorie en a).
  const { data, error } = await supabase.rpc("delete_category", { p_category: categorie, p_move_to: (reprise ?? null) as string, p_reason: raison });
  if (error) {
    const message = treeError(error);
    if (!message) logger.error("Catégorie non supprimée", { module: "admin", code: error.code });
    return { status: "error", message: message ?? "La catégorie n’a pas pu être supprimée.", values: formValues(formData) };
  }
  refresh(true);
  return { status: "success", message: data ? `Catégorie supprimée ; ${data} contenu(s) déplacé(s).` : "Catégorie supprimée." };
}
