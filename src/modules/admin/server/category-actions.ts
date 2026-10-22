"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getCurrentAccount } from "@/server/auth";
import { CATEGORIES_CACHE_TAG } from "@/server/repositories/categories";
import { parseKeywords, slugify } from "../domain/categories";

const common = {
  nom: z.string().trim().min(2, "2 caractères au moins.").max(80, "80 caractères au maximum."),
  mots_cles: z.string().max(2000, "Liste trop longue.").default(""),
  ordre: z.coerce.number({ error: "Nombre attendu." }).int("Nombre entier attendu.").min(-1000).max(100000),
};

const updateSchema = z.object({ categorie: z.uuid(), ...common, active: z.literal("1").optional() });
const createSchema = z.object({
  parent: z.uuid(),
  ...common,
  slug: z.string().trim().max(60, "60 caractères au maximum.").optional(),
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

function refresh() {
  updateTag(CATEGORIES_CACHE_TAG);
  revalidatePath(href("adminCategories"));
}

export async function updateCategoryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = updateSchema.safeParse({
    categorie: read(formData, "categorie"),
    nom: read(formData, "nom"),
    mots_cles: formData.get("mots_cles") ?? "",
    ordre: read(formData, "ordre"),
    active: read(formData, "active"),
  });
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const supabase = await adminClient();
  if (!supabase) return { status: "error", message: "Action réservée aux administrateurs." };

  const { categorie, nom, mots_cles, ordre, active } = parsed.data;
  const { data, error } = await supabase
    .from("categories")
    .update({ name: nom, keywords: parseKeywords(mots_cles), sort_order: ordre, is_active: active === "1" })
    .eq("id", categorie)
    .select("id");
  if (error || !data?.length) {
    if (error) logger.error("Catégorie non modifiée", { module: "admin", code: error.code });
    return { status: "error", message: "La catégorie n’a pas pu être enregistrée.", values: formValues(formData) };
  }
  refresh();
  return { status: "success", message: "Enregistré. Les pages publiques utilisent déjà la nouvelle version." };
}

export async function createCategoryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = createSchema.safeParse({
    parent: read(formData, "parent"),
    nom: read(formData, "nom"),
    slug: read(formData, "slug"),
    mots_cles: formData.get("mots_cles") ?? "",
    ordre: read(formData, "ordre") ?? "100",
  });
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const slug = slugify(parsed.data.slug ?? parsed.data.nom);
  if (!slug) return { status: "error", message: "Vérifiez les champs.", fieldErrors: { slug: "Identifiant invalide." }, values: formValues(formData) };
  const supabase = await adminClient();
  if (!supabase) return { status: "error", message: "Action réservée aux administrateurs." };

  // La sous-catégorie hérite de la famille, des types de contenus et des attributs du parent.
  const { data: parent } = await supabase
    .from("categories")
    .select("family, content_types, attribute_schema")
    .eq("id", parsed.data.parent)
    .maybeSingle();
  if (!parent) return { status: "error", message: "Catégorie parente introuvable." };

  const { error } = await supabase.from("categories").insert({
    parent_id: parsed.data.parent,
    family: parent.family,
    content_types: parent.content_types,
    attribute_schema: parent.attribute_schema,
    slug,
    name: parsed.data.nom,
    keywords: parseKeywords(parsed.data.mots_cles),
    sort_order: parsed.data.ordre,
  });
  if (error) {
    if (error.code === "23505") return { status: "error", message: "Vérifiez les champs.", fieldErrors: { slug: `L’identifiant « ${slug} » existe déjà.` }, values: formValues(formData) };
    logger.error("Catégorie non créée", { module: "admin", code: error.code });
    return { status: "error", message: "La catégorie n’a pas pu être créée.", values: formValues(formData) };
  }
  refresh();
  return { status: "success", message: `« ${parsed.data.nom} » ajoutée (adresse : ${slug}).` };
}
