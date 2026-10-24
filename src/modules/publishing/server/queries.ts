import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { listCategories, type Category } from "@/server/repositories/categories";
import type { CategoryChoice } from "../domain/assistant";
import { draftSchema, type ListingDraft } from "../domain/fields";
import { listPhotos, type DraftPhoto } from "./photo-store";

export type { DraftPhoto };

/** Photos d'une annonce (auteur, équipe ou modération). */
export const listListingPhotos = (listingId: string) => listPhotos({ kind: "annonce", id: listingId });

/** Schémas publiés ailleurs : l'emploi et les opportunités ont leur propre parcours (niveau 17). */
export const JOB_SCHEMAS = ["emploi", "opportunite", "appel_offres"];

export interface PublishableCategory extends CategoryChoice {
  slug: string;
  /** Modèle de fiche : celui de la catégorie, sinon celui de son plus proche parent. */
  schema: string | null;
  /** Champs du modèle activés par l'administration (null : tous). */
  fields: string[] | null;
}

export interface CategoryGroup {
  id: string;
  name: string;
  children: PublishableCategory[];
  /** Mêmes catégories, rangées par sous-rubrique (null : directement sous la rubrique). */
  sections: { name: string | null; children: PublishableCategory[] }[];
}

/** Catégories proposées à la publication, groupées par rubrique (référentiel administrable). */
export async function publishableCategories(): Promise<{ groups: CategoryGroup[]; flat: PublishableCategory[] }> {
  const all = await listCategories();
  const byId = new Map(all.map((category) => [category.id, category]));
  const usable = (category: Category) => category.content_types.includes("listing") && !JOB_SCHEMAS.includes(category.attribute_schema ?? "");
  const withSchema = (category: Category): Category => {
    let current: Category | undefined = category;
    while (current && !current.attribute_schema) current = current.parent_id ? byId.get(current.parent_id) : undefined;
    return current ?? category;
  };
  const toChoice = (category: Category, parent: Category | undefined): PublishableCategory => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    keywords: category.keywords,
    parentName: parent?.name ?? null,
    schema: withSchema(category).attribute_schema,
    fields: withSchema(category).attribute_fields,
  });
  // Parcours de l'arbre dans l'ordre d'affichage : rubrique, sous-rubrique, puis leurs catégories.
  const walk = (category: Category, path: Category[]): { leaf: Category; path: Category[] }[] => {
    const children = all.filter((child) => child.parent_id === category.id && usable(child));
    return children.length ? children.flatMap((child) => walk(child, [...path, child])) : [{ leaf: category, path }];
  };
  // On publie dans une catégorie « feuille » (sans sous-catégorie publiable), rangée sous sa rubrique et sa sous-rubrique.
  const ordered: CategoryGroup[] = all
    .filter((category) => !category.parent_id && usable(category))
    .map((top) => {
      const group: CategoryGroup = { id: top.id, name: top.name, children: [], sections: [] };
      for (const { leaf, path } of walk(top, [top])) {
        const choice = toChoice(leaf, leaf.parent_id ? byId.get(leaf.parent_id) : undefined);
        group.children.push(choice);
        const sectionName = path.length > 2 ? path[1]!.name : null;
        const last = group.sections.at(-1);
        if (last && last.name === sectionName) last.children.push(choice);
        else group.sections.push({ name: sectionName, children: [choice] });
      }
      return group;
    });
  return { groups: ordered, flat: ordered.flatMap((group) => group.children) };
}

const draftRowSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  slug: z.string(),
  status: z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]),
  rejection_reason: z.string().nullable(),
  category_id: z.uuid(),
  title: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  price_unit: z.string().nullable(),
  is_negotiable: z.boolean(),
  neighborhood_id: z.uuid().nullable(),
  location_precision: z.enum(["exact", "approximate", "unknown"]),
  public_location_precision: z.string(),
  attributes: z.record(z.string(), z.unknown()),
  contact_name: z.string().nullable(),
  show_phone: z.boolean(),
  show_whatsapp: z.boolean(),
  show_email: z.boolean(),
  updated_at: z.string(),
});
export type DraftRow = z.infer<typeof draftRowSchema>;

export interface EditableListing {
  row: DraftRow;
  draft: ListingDraft;
}

/** Annonce de la personne connectée, avec sa position privée, prête pour l'éditeur. Null si absente ou non autorisée. */
export async function getEditableListing(id: string): Promise<EditableListing | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  // Position et coordonnées sont des colonnes protégées : lues par la fonction réservée à l'auteur.
  const [{ data, error }, privateFields] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, owner_id, slug, status, rejection_reason, category_id, title, description, price, price_unit, is_negotiable, neighborhood_id, location_precision, public_location_precision, attributes, contact_name, show_phone, show_whatsapp, show_email, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("listing_private_fields", { p_listing: id }),
  ]);
  if (error) throw new Error(`Lecture de l’annonce impossible : ${error.message}`);
  if (!data) return null;
  const row = draftRowSchema.parse(data);
  if (privateFields.error) throw new Error(`Lecture de l’annonce impossible : ${privateFields.error.message}`);
  const hidden = privateFields.data?.[0] ?? null;
  const draft = draftSchema.parse({
    title: row.title,
    description: row.description,
    price: row.price === null ? null : Math.round(row.price),
    priceUnit: row.price_unit,
    negotiable: row.is_negotiable,
    neighborhoodId: row.neighborhood_id,
    lat: hidden?.latitude ?? null,
    lng: hidden?.longitude ?? null,
    exact: row.location_precision === "exact",
    publicPrecision: row.public_location_precision,
    attributes: row.attributes,
    contactName: row.contact_name,
    contactPhone: hidden?.contact_phone ?? null,
    contactWhatsapp: hidden?.contact_whatsapp ?? null,
    contactEmail: hidden?.contact_email ?? null,
    showPhone: row.show_phone,
    showWhatsapp: row.show_whatsapp,
    showEmail: row.show_email,
  });
  return { row, draft };
}

const suggestionSchema = z.object({
  id: z.uuid(),
  field: z.string(),
  value: z.unknown(),
  origin: z.enum(["regles", "ia"]),
  input_kind: z.enum(["texte", "photo", "pdf"]),
  confidence: z.coerce.number(),
  excerpt: z.string().nullable(),
  model: z.string().nullable(),
  status: z.enum(["proposee", "acceptee", "rejetee", "annulee"]),
  previous_value: z.unknown().nullable(),
  created_at: z.string(),
});
export type StoredSuggestion = z.infer<typeof suggestionSchema>;

export async function listSuggestions(listingId: string): Promise<StoredSuggestion[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("listing_suggestions")
    .select("id, field, value, origin, input_kind, confidence, excerpt, model, status, previous_value, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Lecture des suggestions impossible : ${error.message}`);
  return z.array(suggestionSchema).parse(data);
}

const mineSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status: z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]),
  rejection_reason: z.string().nullable(),
  availability_status: z.string(),
  expires_at: z.string().nullable(),
  updated_at: z.string(),
  category: z.object({ name: z.string(), attribute_schema: z.string().nullable() }),
});
export type MyListing = z.infer<typeof mineSchema>;

/** Annonces de la personne connectée, tous statuts (les offres d'emploi ont leur espace). */
export async function listMyListings(userId: string): Promise<MyListing[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, title, status, rejection_reason, availability_status, expires_at, updated_at, category:categories(name, attribute_schema)")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Lecture de vos annonces impossible : ${error.message}`);
  return z
    .array(mineSchema)
    .parse(data)
    .filter((listing) => !JOB_SCHEMAS.includes(listing.category.attribute_schema ?? ""));
}

const pendingSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  price_unit: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
  owner_id: z.uuid(),
  category: z.object({ name: z.string(), attribute_schema: z.string().nullable() }),
});
export type PendingListing = z.infer<typeof pendingSchema>;

/** File de modération des annonces (hors emploi, modéré dans `/admin/offres`). */
export async function listPendingListings(): Promise<PendingListing[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, title, description, price, price_unit, attributes, created_at, updated_at, owner_id, category:categories(name, attribute_schema)")
    .eq("status", "pending")
    .order("updated_at")
    .limit(50);
  if (error) throw new Error(`Lecture de la file de modération impossible : ${error.message}`);
  return z
    .array(pendingSchema)
    .parse(data)
    .filter((listing) => !JOB_SCHEMAS.includes(listing.category.attribute_schema ?? ""));
}
