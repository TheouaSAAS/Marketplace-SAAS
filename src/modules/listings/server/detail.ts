import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { publicMediaUrl } from "@/lib/storage";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { single, verificationStatusSchema } from "@/modules/shared/server/schemas";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { rankSimilar } from "../domain/similar";
import { LISTINGS_CACHE_TAG, listListingsByIds, type ListingCardData } from "./queries";

/*
 * Lecture d'une annonce pour sa page de détail, colonnes publiques uniquement
 * (les droits par colonne de la base rendent illisibles la position exacte,
 * l'adresse et les coordonnées de contact).
 */

const listingDetailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  price_unit: z.enum(["total", "par_mois", "par_jour", "par_nuit", "par_heure", "a_partir_de"]).nullable(),
  currency: z.string(),
  is_negotiable: z.boolean(),
  attributes: z.record(z.string(), z.unknown()),
  availability_status: z.enum(["available", "reserved", "unavailable", "unknown"]),
  available_from: z.string().nullable(),
  last_confirmed_at: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  status: z.string(),
  rejection_reason: z.string().nullable(),
  published_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  updated_at: z.string(),
  owner_id: z.uuid(),
  organization_id: z.uuid().nullable(),
  city_id: z.uuid(),
  public_location_precision: z.enum(["exact", "approximate", "neighborhood", "hidden"]),
  show_phone: z.boolean(),
  show_whatsapp: z.boolean(),
  show_email: z.boolean(),
  contact_name: z.string().nullable(),
  category: single(
    z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      icon: z.string().nullable(),
      attribute_schema: z.string().nullable(),
      parent_id: z.uuid().nullable(),
    }),
  ),
  neighborhood: single(z.object({ id: z.uuid(), name: z.string(), slug: z.string() }).nullable()),
  city: single(z.object({ name: z.string(), slug: z.string() })),
});

export type ListingDetail = z.infer<typeof listingDetailSchema>;

const DETAIL_COLUMNS = [
  "id, slug, title, description, price, price_unit, currency, is_negotiable, attributes, availability_status, available_from",
  "last_confirmed_at, verification_status, verified_at, status, rejection_reason, published_at, expires_at, updated_at",
  "owner_id, organization_id, city_id, public_location_precision, show_phone, show_whatsapp, show_email, contact_name",
  "category:categories(id, name, slug, icon, attribute_schema, parent_id)",
  "neighborhood:neighborhoods(id, name, slug)",
  "city:cities(name, slug)",
].join(", ");

export function listingTag(slug: string): string {
  return `${LISTINGS_CACHE_TAG}:annonce:${slug}`;
}

/** Annonce visible du public (publiée, active, statut de vérification montrable), ou null. */
export async function getPublicListing(slug: string): Promise<ListingDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_CACHE_TAG, listingTag(slug));

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("listings").select(DETAIL_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Lecture de l’annonce impossible : ${error.message}`);
  return data ? listingDetailSchema.parse(data) : null;
}

/** Annonce lue avec la session : son auteur, son organisation ou l'équipe la voient quel que soit son statut. */
export async function getListingForSession(slug: string): Promise<ListingDetail | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("listings").select(DETAIL_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Lecture de l’annonce impossible : ${error.message}`);
  return data ? listingDetailSchema.parse(data) : null;
}

const stateSchema = z.array(
  z.object({ listing_id: z.uuid(), state: z.enum(["expired", "archived"]), title: z.string(), category_id: z.uuid(), city_id: z.uuid() }),
);

/** Annonce qui a été publique mais ne l'est plus (expirée ou archivée). */
export async function getListingPublicState(slug: string) {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("listing_public_state", { p_slug: slug });
  if (error) throw new Error(`Lecture de l’état de l’annonce impossible : ${error.message}`);
  return stateSchema.parse(data)[0] ?? null;
}

const imageSchema = z.object({
  id: z.uuid(),
  storage_path: z.string(),
  alt_text: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});

export interface ListingImage {
  id: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export async function getListingImages(listingId: string): Promise<ListingImage[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("images")
    .select("id, storage_path, alt_text, width, height")
    .eq("listing_id", listingId)
    // Les photos encore privées (annonce non publiée ou modifiée) ne sont jamais montrées au public.
    .eq("bucket", "media")
    .order("sort_order");
  if (error) throw new Error(`Lecture des images impossible : ${error.message}`);
  return z
    .array(imageSchema)
    .parse(data)
    .flatMap((image) => {
      const url = publicMediaUrl(image.storage_path);
      return url ? [{ id: image.id, url, alt: image.alt_text ?? "", width: image.width, height: image.height }] : [];
    });
}

const pointSchema = z.array(
  z.object({ lat: z.number(), lng: z.number(), location_precision: z.enum(["exact", "approximate", "neighborhood", "hidden"]) }),
);

/** Position publique (déjà dégradée selon le choix de l'annonceur), ou null. */
export async function getListingPoint(listingId: string, asSession = false) {
  const supabase = asSession ? await createSessionSupabaseClient() : createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("listing_public_point", { p_listing: listingId });
  if (error) throw new Error(`Lecture de la position impossible : ${error.message}`);
  return pointSchema.parse(data)[0] ?? null;
}

const sellerSchema = z.array(
  z.object({
    display_name: z.string(),
    avatar_url: z.string().nullable(),
    member_since: z.string(),
    is_professional: z.boolean(),
    organization_name: z.string().nullable(),
    active_listings: z.number(),
  }),
);

export type ListingSeller = z.infer<typeof sellerSchema>[number];

export async function getListingSeller(listingId: string, asSession = false): Promise<ListingSeller | null> {
  const supabase = asSession ? await createSessionSupabaseClient() : createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("listing_seller", { p_listing: listingId });
  if (error) throw new Error(`Lecture de l’annonceur impossible : ${error.message}`);
  return sellerSchema.parse(data)[0] ?? null;
}

const candidateSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  category_id: z.uuid(),
  neighborhood_id: z.uuid().nullable(),
  price: z.number().nullable(),
  published_at: z.string().nullable(),
});

export interface SimilarListing {
  listing: ListingCardData;
  reasons: string[];
}

/**
 * Annonces similaires (règles de `rankSimilar`) : même ville, même famille de
 * catégories. Mises en cache quelques minutes.
 */
export async function getSimilarListings(target: {
  id: string;
  ownerId: string;
  cityId: string;
  categoryId: string;
  neighborhoodId: string | null;
  price: number | null;
  publishedAt: string | null;
}): Promise<SimilarListing[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_CACHE_TAG, `${LISTINGS_CACHE_TAG}:${target.cityId}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const categories = await listCategories();
  const category = categories.find((item) => item.id === target.categoryId);
  if (!category) return [];
  const root = category.parent_id ? categories.find((item) => item.id === category.parent_id) ?? category : category;
  const family = categoryIdsWithDescendants(categories, [root.slug]);

  const { data, error } = await supabase
    .from("listings")
    .select("id, owner_id, category_id, neighborhood_id, price, published_at")
    .eq("city_id", target.cityId)
    .eq("status", "published")
    .in("category_id", family)
    .neq("id", target.id)
    .order("published_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`Lecture des annonces similaires impossible : ${error.message}`);

  const matches = rankSimilar(
    target,
    z
      .array(candidateSchema)
      .parse(data)
      .map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        categoryId: row.category_id,
        neighborhoodId: row.neighborhood_id,
        price: row.price,
        publishedAt: row.published_at,
      })),
  );
  const cards = await listListingsByIds(matches.map((match) => match.id));
  const byId = new Map(cards.map((card) => [card.id, card]));
  return matches.flatMap((match) => {
    const listing = byId.get(match.id);
    return listing ? [{ listing, reasons: match.reasons }] : [];
  });
}

/** Autres annonces publiques du même annonceur (les plus récentes). */
export async function getOtherListingsFromOwner(ownerId: string, excludeId: string, limit = 4): Promise<ListingCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("status", "published")
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Lecture des annonces de l’annonceur impossible : ${error.message}`);
  return listListingsByIds(z.array(z.object({ id: z.uuid() })).parse(data).map((row) => row.id));
}

const engagementSchema = z.array(z.object({ likes: z.number(), liked: z.boolean(), comments: z.number(), views: z.number() }));

/** Totaux publics + « j'aime » de la personne connectée. */
export async function getListingEngagement(listingId: string) {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("listing_engagement", { p_listing: listingId });
  if (error) throw new Error(`Lecture de l’engagement impossible : ${error.message}`);
  return engagementSchema.parse(data)[0] ?? null;
}

const commentSchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  body: z.string(),
  created_at: z.string(),
  author_name: z.string(),
  is_seller: z.boolean(),
  is_mine: z.boolean(),
});

export type ListingComment = z.infer<typeof commentSchema> & { replies: z.infer<typeof commentSchema>[] };

/** Commentaires visibles, regroupés en fils (une réponse de l'annonceur par question au plus d'un niveau). */
export async function getListingComments(listingId: string): Promise<ListingComment[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("listing_comment_thread", { p_listing: listingId });
  if (error) throw new Error(`Lecture des commentaires impossible : ${error.message}`);
  const rows = z.array(commentSchema).parse(data);
  const threads = rows.filter((row) => !row.parent_id).map((row) => ({ ...row, replies: [] as z.infer<typeof commentSchema>[] }));
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  for (const row of rows) {
    if (row.parent_id) byId.get(row.parent_id)?.replies.push(row);
  }
  return threads;
}

/** Favori de la personne connectée pour cette annonce. */
export async function isFavoriteListing(listingId: string, userId: string): Promise<boolean> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return false;
  const { data } = await supabase.from("favorites").select("id").eq("user_id", userId).eq("listing_id", listingId).maybeSingle();
  return data !== null;
}
