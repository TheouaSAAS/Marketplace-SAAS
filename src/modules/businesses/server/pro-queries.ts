import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { listListingsByIds } from "@/modules/listings/server/queries";
import { listCategories } from "@/server/repositories/categories";
import { listPhotos } from "@/modules/publishing/server/photo-store";
import { faqSchema, linksSchema, type TeamRole } from "../domain/pro";
import { BUSINESSES_CACHE_TAG } from "./queries";

// -----------------------------------------------------------------------------
// Page publique : compléments (photos publiées, avis, note, annonces, badges)
// -----------------------------------------------------------------------------
const reviewSchema = z.object({
  id: z.uuid(),
  rating: z.number(),
  body: z.string().nullable(),
  created_at: z.string(),
  author_name: z.string(),
  response_body: z.string().nullable(),
  response_at: z.string().nullable(),
});
export type PublicReview = z.infer<typeof reviewSchema>;

export interface ProPublicExtras {
  photos: { id: string; url: string; alt: string; width: number | null; height: number | null }[];
  reviews: PublicReview[];
  rating: { count: number; average: number | null };
  sponsored: boolean;
  verificationPending: boolean;
  faq: z.infer<typeof faqSchema>;
  links: z.infer<typeof linksSchema>;
  isClaimed: boolean;
  organizationId: string | null;
  listingIds: string[];
}

/** Ce qu'une page publique affiche en plus de la fiche (lecture publique, mise en cache). */
export async function getProPublicExtras(businessId: string): Promise<ProPublicExtras> {
  "use cache";
  cacheLife("minutes");
  cacheTag(BUSINESSES_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  const empty: ProPublicExtras = { photos: [], reviews: [], rating: { count: 0, average: null }, sponsored: false, verificationPending: false, faq: [], links: [], isClaimed: true, organizationId: null, listingIds: [] };
  if (!supabase) return empty;
  const [page, photos, reviews, rating, badges] = await Promise.all([
    supabase.from("business_profiles").select("faq, links, is_claimed, organization_id, owner_id").eq("id", businessId).eq("status", "published").maybeSingle(),
    supabase.from("images").select("id, storage_path, alt_text, width, height").eq("business_id", businessId).eq("bucket", "media").order("sort_order").limit(12),
    supabase.rpc("business_reviews", { p_business: businessId, p_limit: 20 }),
    supabase.rpc("business_rating", { p_business: businessId }),
    supabase.rpc("business_public_badges", { p_ids: [businessId] }),
  ]);
  if (page.error) throw new Error(`Lecture de la page impossible : ${page.error.message}`);
  if (!page.data) return empty;
  // Annonces publiées rattachées à la page ou à son équipe.
  const filters = [`business_id.eq.${businessId}`, ...(page.data.organization_id ? [`organization_id.eq.${page.data.organization_id}`] : [])];
  const { data: listings } = await supabase.from("listings").select("id").eq("status", "published").or(filters.join(",")).order("published_at", { ascending: false }).limit(6);
  const base = supabase.storage.from("media");
  const ratingRow = rating.data?.[0];
  return {
    photos: (photos.data ?? []).map((photo) => ({ id: photo.id, url: base.getPublicUrl(photo.storage_path).data.publicUrl, alt: photo.alt_text ?? "", width: photo.width, height: photo.height })),
    reviews: z.array(reviewSchema).parse(reviews.data ?? []),
    rating: { count: ratingRow?.review_count ?? 0, average: ratingRow?.average === null || ratingRow?.average === undefined ? null : Number(ratingRow.average) },
    sponsored: badges.data?.[0]?.sponsored ?? false,
    verificationPending: badges.data?.[0]?.verification_pending ?? false,
    faq: faqSchema.catch([]).parse(page.data.faq),
    links: linksSchema.catch([]).parse(page.data.links),
    isClaimed: page.data.is_claimed,
    organizationId: page.data.organization_id,
    listingIds: (listings ?? []).map((listing) => listing.id),
  };
}

export const listProListings = (ids: string[]) => listListingsByIds(ids);

// -----------------------------------------------------------------------------
// Espace de gestion
// -----------------------------------------------------------------------------
const mineSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]),
  rejection_reason: z.string().nullable(),
  verification_status: z.string(),
  updated_at: z.string(),
  owner_id: z.uuid(),
  organization_id: z.uuid().nullable(),
});
export type MyProPage = z.infer<typeof mineSchema> & { role: TeamRole };

/** Pages dont la personne est titulaire ou membre de l'équipe (règles d'accès de la base). */
export async function listMyProPages(userId: string): Promise<MyProPage[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data: memberships, error: membershipError } = await supabase.from("organization_members").select("organization_id, role").eq("user_id", userId);
  if (membershipError) throw new Error(`Lecture de vos équipes impossible : ${membershipError.message}`);
  const roles = new Map((memberships ?? []).map((item) => [item.organization_id, item.role as TeamRole]));
  const filters = [`owner_id.eq.${userId}`, ...(roles.size ? [`organization_id.in.(${[...roles.keys()].join(",")})`] : [])];
  const { data, error } = await supabase
    .from("business_profiles")
    .select("id, slug, name, status, rejection_reason, verification_status, updated_at, owner_id, organization_id")
    .or(filters.join(","))
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Lecture de vos pages impossible : ${error.message}`);
  return z
    .array(mineSchema)
    .parse(data)
    .map((page) => ({ ...page, role: page.owner_id === userId ? "owner" : (roles.get(page.organization_id ?? "") ?? "viewer") }));
}

const pageSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]),
  rejection_reason: z.string().nullable(),
  owner_id: z.uuid(),
  organization_id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  neighborhood_id: z.uuid().nullable(),
  description: z.string().nullable(),
  services: z.array(z.string()),
  service_area: z.string().nullable(),
  availability_note: z.string().nullable(),
  accepts_quotes: z.boolean(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  opening_hours: z.unknown().nullable(),
  faq: z.unknown(),
  links: z.unknown(),
  verification_status: z.string(),
  verified_at: z.string().nullable(),
  updated_at: z.string(),
});
export type ManagedPage = Omit<z.infer<typeof pageSchema>, "faq" | "links"> & { faq: z.infer<typeof faqSchema>; links: z.infer<typeof linksSchema> };

const teamSchema = z.array(z.object({ member_id: z.uuid(), user_id: z.uuid(), display_name: z.string(), role: z.enum(["owner", "admin", "editor", "viewer"]), joined_at: z.string() }));
const invitationSchema = z.array(z.object({ id: z.uuid(), role: z.enum(["owner", "admin", "editor", "viewer"]), created_at: z.string(), expires_at: z.string(), accepted_at: z.string().nullable(), revoked_at: z.string().nullable() }));
const receivedSchema = z.array(
  z.object({
    id: z.uuid(),
    rating: z.number(),
    body: z.string().nullable(),
    status: z.string(),
    created_at: z.string(),
    author_name: z.string(),
    response_body: z.string().nullable(),
    response_at: z.string().nullable(),
  }),
);
const requestSchema = z.array(z.object({ id: z.uuid(), status: z.enum(["pending", "approved", "rejected"]), decision_note: z.string().nullable(), created_at: z.string() }));

export interface ManagedPageData {
  page: ManagedPage;
  role: TeamRole;
  team: z.infer<typeof teamSchema>;
  invitations: z.infer<typeof invitationSchema>;
  reviews: z.infer<typeof receivedSchema>;
  verificationRequests: z.infer<typeof requestSchema>;
}

/** Tout l'espace de gestion d'une page ; null si la personne n'y a pas accès. */
export async function getManagedPage(id: string, userId: string): Promise<ManagedPageData | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, slug, name, status, rejection_reason, owner_id, organization_id, category_id, neighborhood_id, description, services, service_area, availability_note, accepts_quotes, phone, whatsapp, email, website, opening_hours, faq, links, verification_status, verified_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la page impossible : ${error.message}`);
  if (!data) return null;
  const row = pageSchema.parse(data);
  let role: TeamRole | null = row.owner_id === userId ? "owner" : null;
  if (!role && row.organization_id) {
    const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", row.organization_id).eq("user_id", userId).maybeSingle();
    role = (membership?.role as TeamRole | undefined) ?? null;
  }
  if (!role) return null;
  const [team, invitations, reviews, requests] = await Promise.all([
    row.organization_id ? supabase.rpc("organization_team", { p_organization: row.organization_id }) : Promise.resolve({ data: [] }),
    row.organization_id
      ? supabase.from("organization_invitations").select("id, role, created_at, expires_at, accepted_at, revoked_at").eq("organization_id", row.organization_id).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    supabase.rpc("received_business_reviews", { p_business: id }),
    supabase.from("business_verification_requests").select("id, status, decision_note, created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(5),
  ]);
  return {
    page: { ...row, faq: faqSchema.catch([]).parse(row.faq), links: linksSchema.catch([]).parse(row.links) },
    role,
    team: teamSchema.parse(team.data ?? []),
    invitations: invitationSchema.parse(invitations.data ?? []),
    reviews: receivedSchema.parse(reviews.data ?? []),
    verificationRequests: requestSchema.parse(requests.data ?? []),
  };
}

export const listProPhotos = (businessId: string) => listPhotos({ kind: "pro", id: businessId });

// -----------------------------------------------------------------------------
// Modération (équipe)
// -----------------------------------------------------------------------------
const pendingPageSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  services: z.array(z.string()),
  service_area: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  links: z.unknown(),
  faq: z.unknown(),
  updated_at: z.string(),
  category: z.object({ name: z.string() }).nullable(),
});
export type PendingPage = z.infer<typeof pendingPageSchema>;

export async function listPendingProPages(): Promise<PendingPage[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("business_profiles")
    .select("id, slug, name, description, services, service_area, phone, email, website, links, faq, updated_at, category:categories(name)")
    .eq("status", "pending")
    .order("updated_at")
    .limit(50);
  if (error) throw new Error(`Lecture de la file des pages impossible : ${error.message}`);
  return z.array(pendingPageSchema).parse(data);
}

const verificationQueueSchema = z.array(
  z.object({ id: z.uuid(), evidence: z.string(), created_at: z.string(), business: z.object({ name: z.string(), slug: z.string() }) }),
);
export async function listPendingVerifications() {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("business_verification_requests")
    .select("id, evidence, created_at, business:business_profiles(name, slug)")
    .eq("status", "pending")
    .order("created_at")
    .limit(50);
  if (error) throw new Error(`Lecture des demandes de vérification impossible : ${error.message}`);
  return verificationQueueSchema.parse(data);
}

const pendingReviewSchema = z.array(
  z.object({
    id: z.uuid(),
    rating: z.number(),
    body: z.string().nullable(),
    created_at: z.string(),
    business: z.object({ name: z.string(), slug: z.string() }).nullable(),
  }),
);
export async function listPendingReviews() {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, business:business_profiles(name, slug)")
    .eq("status", "pending")
    .not("business_id", "is", null)
    .order("created_at")
    .limit(50);
  if (error) throw new Error(`Lecture des avis en attente impossible : ${error.message}`);
  return pendingReviewSchema.parse(data);
}

/** Catégories ouvertes aux pages professionnelles (référentiel), libellées « Rubrique › Métier ». */
/** Activité déclarée à l'inscription (profil professionnel) : préremplit la création de la page, rien de plus. */
export async function pendingBusiness(userId: string): Promise<{ nom: string; categorie: string } | null> {
  const supabase = await createSessionSupabaseClient();
  const { data } = (await supabase?.from("user_preferences").select("pending_business_name, pending_business_category").eq("user_id", userId).maybeSingle()) ?? { data: null };
  if (!data?.pending_business_name) return null;
  return { nom: data.pending_business_name, categorie: data.pending_business_category ?? "" };
}

export async function proCategories(): Promise<{ id: string; name: string }[]> {
  const all = await listCategories();
  const byId = new Map(all.map((category) => [category.id, category]));
  const usable = all.filter((category) => category.content_types.includes("business"));
  return usable
    .filter((category) => !usable.some((child) => child.parent_id === category.id))
    .map((category) => {
      const parent = category.parent_id ? byId.get(category.parent_id) : undefined;
      return { id: category.id, name: parent ? `${parent.name} › ${category.name}` : category.name };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const planSchema = z.array(
  z.object({ code: z.string(), name: z.string(), description: z.string().nullable(), price_xof: z.number(), features: z.array(z.string()), is_active: z.boolean() }),
);

/** Offres du référentiel (sans paiement tant qu'aucun prestataire n'est configuré). */
export async function listPlans() {
  "use cache";
  cacheLife("hours");
  cacheTag(BUSINESSES_CACHE_TAG);
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("plans").select("code, name, description, price_xof, features, is_active").order("sort_order");
  if (error) throw new Error(`Lecture des offres impossible : ${error.message}`);
  return planSchema.parse(data);
}
