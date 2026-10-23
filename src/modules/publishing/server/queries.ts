import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { listCategories, type Category } from "@/server/repositories/categories";
import type { CategoryChoice } from "../domain/assistant";
import { draftSchema, type ListingDraft } from "../domain/fields";

/** Schémas publiés ailleurs : l'emploi et les opportunités ont leur propre parcours (niveau 17). */
export const JOB_SCHEMAS = ["emploi", "opportunite", "appel_offres"];

export interface PublishableCategory extends CategoryChoice {
  slug: string;
  schema: string | null;
}

export interface CategoryGroup {
  id: string;
  name: string;
  children: PublishableCategory[];
}

/** Catégories proposées à la publication, groupées par rubrique (référentiel administrable). */
export async function publishableCategories(): Promise<{ groups: CategoryGroup[]; flat: PublishableCategory[] }> {
  const all = await listCategories();
  const byId = new Map(all.map((category) => [category.id, category]));
  const usable = (category: Category) => category.content_types.includes("listing") && !JOB_SCHEMAS.includes(category.attribute_schema ?? "");
  const toChoice = (category: Category, parent: Category | undefined): PublishableCategory => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    keywords: category.keywords,
    parentName: parent?.name ?? null,
    schema: category.attribute_schema,
  });
  const root = (category: Category): Category => {
    let current = category;
    while (current.parent_id && byId.has(current.parent_id)) current = byId.get(current.parent_id)!;
    return current;
  };
  // On publie dans une catégorie « feuille » (sans sous-catégorie publiable), rangée sous sa rubrique.
  const leaves = all.filter((category) => usable(category) && !all.some((child) => child.parent_id === category.id && usable(child)));
  const groups = new Map<string, CategoryGroup>();
  for (const leaf of leaves) {
    const top = root(leaf);
    const group = groups.get(top.id) ?? { id: top.id, name: top.name, children: [] };
    group.children.push(toChoice(leaf, leaf.parent_id ? byId.get(leaf.parent_id) : undefined));
    groups.set(top.id, group);
  }
  const ordered = [...groups.values()];
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

const photoSchema = z.object({
  id: z.uuid(),
  storage_path: z.string(),
  bucket: z.enum(["media", "private-media"]),
  alt_text: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  content_hash: z.string().nullable(),
});

export interface DraftPhoto {
  id: string;
  url: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  hash: string | null;
  /** Mêmes octets dans une autre annonce de l'auteur / d'un autre compte. */
  ownDuplicates: number;
  otherDuplicates: number;
}

/** Photos d'une annonce (auteur ou équipe), avec adresses signées pour celles encore privées. */
export async function listListingPhotos(listingId: string): Promise<DraftPhoto[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const [{ data, error }, duplicates] = await Promise.all([
    supabase.from("images").select("id, storage_path, bucket, alt_text, width, height, content_hash").eq("listing_id", listingId).order("sort_order").order("created_at"),
    supabase.rpc("listing_image_duplicates", { p_listing: listingId }),
  ]);
  if (error) throw new Error(`Lecture des photos impossible : ${error.message}`);
  const photos = z.array(photoSchema).parse(data);
  const privatePaths = photos.filter((photo) => photo.bucket === "private-media").map((photo) => photo.storage_path);
  const signed = privatePaths.length ? ((await supabase.storage.from("private-media").createSignedUrls(privatePaths, 3600)).data ?? []) : [];
  const signedByPath = new Map(signed.map((item) => [item.path, item.signedUrl]));
  const duplicateById = new Map((duplicates.data ?? []).map((item) => [item.image_id, item]));
  return photos.map((photo) => ({
    id: photo.id,
    url: photo.bucket === "private-media" ? (signedByPath.get(photo.storage_path) ?? null) : supabase.storage.from("media").getPublicUrl(photo.storage_path).data.publicUrl,
    alt: photo.alt_text ?? "",
    width: photo.width,
    height: photo.height,
    hash: photo.content_hash,
    ownDuplicates: duplicateById.get(photo.id)?.own_matches ?? 0,
    otherDuplicates: duplicateById.get(photo.id)?.other_matches ?? 0,
  }));
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
