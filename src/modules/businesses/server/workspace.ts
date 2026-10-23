import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { completeness, type TeamRole } from "../domain/pro";

/**
 * Lectures de l'espace professionnel d'une page. Chaque fonction passe par la
 * session : la base ne répond que pour les membres de l'équipe de la page.
 */

async function client() {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) throw new Error("Base indisponible");
  return supabase;
}

const pageSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]),
  rejection_reason: z.string().nullable(),
  verification_status: z.string(),
  verified_at: z.string().nullable(),
  owner_id: z.uuid(),
  organization_id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  description: z.string().nullable(),
  services: z.array(z.string()),
  service_area: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  opening_hours: z.unknown().nullable(),
  photos: z.array(z.object({ count: z.number() })),
  organization: z.object({ name: z.string(), kind: z.string() }).nullable(),
});

export interface Workspace {
  page: Omit<z.infer<typeof pageSchema>, "photos">;
  role: TeamRole;
  isHolder: boolean;
  complete: boolean;
  missing: string[];
  verificationPending: boolean;
}

/** En-tête de l'espace : la page, le rôle de la personne et la complétude. Null si elle n'est pas membre. */
export const getWorkspace = cache(async (id: string, userId: string): Promise<Workspace | null> => {
  const supabase = await client();
  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, slug, name, status, rejection_reason, verification_status, verified_at, owner_id, organization_id, category_id, description, services, service_area, phone, whatsapp, email, website, opening_hours, photos:images(count), organization:organizations(name, kind)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la page impossible : ${error.message}`);
  if (!data) return null;
  const { photos, ...page } = pageSchema.parse(data);
  let role: TeamRole | null = page.owner_id === userId ? "owner" : null;
  if (!role && page.organization_id) {
    const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", page.organization_id).eq("user_id", userId).maybeSingle();
    role = (membership?.role as TeamRole | undefined) ?? null;
  }
  if (!role) return null;
  const { data: pending } = await supabase.from("business_verification_requests").select("id").eq("business_id", id).eq("status", "pending").limit(1);
  const check = completeness({ ...page, category: page.category_id, photoCount: photos[0]?.count ?? 0 });
  return { page, role, isHolder: page.owner_id === userId, complete: check.complete, missing: check.missing, verificationPending: Boolean(pending?.length) };
});

const listingSchema = z.array(
  z.object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    status: z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]),
    availability_status: z.string(),
    rejection_reason: z.string().nullable(),
    expires_at: z.string().nullable(),
    updated_at: z.string(),
    category_name: z.string(),
    schema: z.string().nullable(),
    views: z.number(),
    favorites: z.number(),
    contact_reveals: z.number(),
    conversations: z.number(),
  }),
);
export type ProListing = z.infer<typeof listingSchema>[number];

export async function listWorkspaceListings(id: string): Promise<ProListing[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("pro_listings", { p_business: id });
  if (error) throw new Error(`Lecture des annonces impossible : ${error.message}`);
  return listingSchema.parse(data);
}

const eventSchema = z.array(z.object({ id: z.uuid(), slug: z.string(), title: z.string(), status: z.string(), starts_at: z.string(), rejection_reason: z.string().nullable() }));
export async function listWorkspaceEvents(id: string) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("pro_events", { p_business: id });
  if (error) throw new Error(`Lecture des événements impossible : ${error.message}`);
  return eventSchema.parse(data);
}

const statsSchema = z.object({
  page_views: z.number(),
  page_favorites: z.number(),
  requests_total: z.number(),
  requests_30d: z.number(),
  requests_unanswered: z.number(),
  conversations: z.number(),
  reviews_published: z.number(),
  rating_average: z.coerce.number().nullable(),
  listings_published: z.number(),
  listing_views: z.coerce.number(),
  listing_favorites: z.number(),
  listing_contact_reveals: z.number(),
});
export type ProStats = z.infer<typeof statsSchema>;

export async function getWorkspaceStats(id: string): Promise<ProStats | null> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("pro_stats", { p_business: id });
  if (error) throw new Error(`Lecture des statistiques impossible : ${error.message}`);
  return data?.[0] ? statsSchema.parse(data[0]) : null;
}

const historySchema = z.array(
  z.object({ changed_at: z.string(), entity: z.enum(["page", "annonce"]), title: z.string().nullable(), status_before: z.string().nullable(), status_after: z.string().nullable(), reason: z.string().nullable() }),
);
export type ModerationEntry = z.infer<typeof historySchema>[number];

export async function getModerationHistory(id: string): Promise<ModerationEntry[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("pro_moderation_history", { p_business: id });
  if (error) throw new Error(`Lecture de l’historique impossible : ${error.message}`);
  return historySchema.parse(data);
}

const verificationSchema = z.array(z.object({ id: z.uuid(), status: z.enum(["pending", "approved", "rejected"]), evidence: z.string(), decision_note: z.string().nullable(), created_at: z.string(), decided_at: z.string().nullable() }));
export async function listVerificationRequests(id: string) {
  const supabase = await client();
  const { data, error } = await supabase
    .from("business_verification_requests")
    .select("id, status, evidence, decision_note, created_at, decided_at")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Lecture des demandes de vérification impossible : ${error.message}`);
  return verificationSchema.parse(data);
}

const requestSchema = z.array(
  z.object({
    id: z.uuid(),
    kind: z.enum(["contact", "devis"]),
    status: z.enum(["new", "read", "replied", "archived"]),
    created_at: z.string(),
    sender_name: z.string(),
    sender_email: z.string().nullable(),
    sender_phone: z.string().nullable(),
    message: z.string(),
    details: z.unknown(),
    consented_at: z.string().nullable(),
  }),
);
export type InboxRequest = z.infer<typeof requestSchema>[number];

/** Demandes adressées à la page (gestionnaires seulement ; un lecteur n'en reçoit aucune, règle en base). */
export async function listInbox(id: string): Promise<InboxRequest[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("contact_requests")
    .select("id, kind, status, created_at, sender_name, sender_email, sender_phone, message, details, consented_at")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Lecture des demandes impossible : ${error.message}`);
  return requestSchema.parse(data);
}

/** Page au nom de laquelle publier : seulement si la personne la gère (éditeur ou plus). */
export async function getManageablePage(id: string | undefined): Promise<{ id: string; name: string } | null> {
  if (!id || !z.uuid().safeParse(id).success) return null;
  // Lecture liée à la session de la requête (jamais pré-rendue).
  await connection();
  const supabase = await client();
  const { data: allowed } = await supabase.rpc("is_page_manager", { p_business: id });
  if (!allowed) return null;
  const { data } = await supabase.from("business_profiles").select("id, name").eq("id", id).maybeSingle();
  return data ?? null;
}
