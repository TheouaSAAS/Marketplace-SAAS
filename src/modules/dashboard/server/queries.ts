import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { listMyListings, type MyListing } from "@/modules/publishing/server/queries";
import type { ListingState } from "../domain/dashboard";

/**
 * Lectures du tableau de bord : toujours avec la session de la personne
 * connectée, les règles d'accès de la base ne renvoyant que ses données.
 */

async function client() {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) throw new Error("Base indisponible");
  return supabase;
}

const statsSchema = z.array(z.object({ listing_id: z.uuid(), views: z.number(), favorites: z.number(), contact_reveals: z.number(), conversations: z.number() }));
export type ListingStats = Omit<z.infer<typeof statsSchema>[number], "listing_id">;

export type DashboardListing = MyListing & { stats: ListingStats };

/** Mes annonces (hors offres d'emploi) avec leurs statistiques. */
export async function listDashboardListings(userId: string): Promise<DashboardListing[]> {
  const supabase = await client();
  const [listings, { data, error }] = await Promise.all([listMyListings(userId), supabase.rpc("my_listing_stats")]);
  if (error) throw new Error(`Lecture des statistiques impossible : ${error.message}`);
  const stats = new Map(statsSchema.parse(data).map(({ listing_id, ...row }) => [listing_id, row]));
  const empty: ListingStats = { views: 0, favorites: 0, contact_reveals: 0, conversations: 0 };
  return listings.map((listing) => ({ ...listing, stats: stats.get(listing.id) ?? empty }));
}

const historySchema = z.array(
  z.object({
    changed_at: z.string(),
    action: z.enum(["insert", "update", "delete"]),
    status_before: z.string().nullable(),
    status_after: z.string().nullable(),
    availability_before: z.string().nullable(),
    availability_after: z.string().nullable(),
  }),
);
export type ListingHistory = z.infer<typeof historySchema>;

/** Changements de statut et de disponibilité d'une de mes annonces. */
export async function getListingHistory(listingId: string): Promise<ListingHistory> {
  const supabase = await client();
  const { data, error } = await supabase.rpc("my_listing_history", { p_listing: listingId });
  if (error) throw new Error(`Lecture de l’historique impossible : ${error.message}`);
  return historySchema.parse(data);
}

export interface Overview {
  listings: Record<ListingState, number>;
  favorites: number;
  savedSearches: number;
  unreadNotifications: number;
  unreadMessages: number;
  openReports: number;
  newContactRequests: number;
}

/** Chiffres de la vue d'ensemble (une requête par source, toutes limitées à la personne). */
export async function getOverview(userId: string): Promise<Overview> {
  const supabase = await client();
  const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: total, error } = await query;
    if (error) throw new Error(`Lecture du tableau de bord impossible : ${error.message}`);
    return total ?? 0;
  };
  const [listings, favorites, savedSearches, unreadNotifications, conversations, openReports, newContactRequests] = await Promise.all([
    listMyListings(userId),
    count(supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", userId)),
    count(supabase.from("saved_searches").select("id", { count: "exact", head: true }).eq("user_id", userId)),
    count(supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null)),
    supabase.rpc("my_conversations"),
    count(supabase.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", userId).in("status", ["open", "reviewing"])),
    count(supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("recipient_id", userId).eq("status", "new")),
  ]);
  const byState = { draft: 0, pending: 0, published: 0, rejected: 0, expired: 0, archived: 0 } satisfies Record<ListingState, number>;
  for (const listing of listings) byState[listing.status] += 1;
  const unreadMessages = (conversations.data ?? []).reduce((total: number, row: { unread: number }) => total + Number(row.unread), 0);
  return { listings: byState, favorites, savedSearches, unreadNotifications, unreadMessages, openReports, newContactRequests };
}

const reportSchema = z.array(
  z.object({
    id: z.uuid(),
    reason: z.string(),
    status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
    created_at: z.string(),
    handled_at: z.string().nullable(),
    resolution_note: z.string().nullable(),
    listing: z.object({ title: z.string(), slug: z.string() }).nullable(),
    place: z.object({ name: z.string(), slug: z.string() }).nullable(),
    event: z.object({ title: z.string(), slug: z.string() }).nullable(),
    business: z.object({ name: z.string(), slug: z.string() }).nullable(),
  }),
);
export type MyReport = z.infer<typeof reportSchema>[number];

/** Mes signalements et leur suivi (l'objet signalé peut avoir été retiré depuis). */
export async function listMyReports(userId: string): Promise<MyReport[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, reason, status, created_at, handled_at, resolution_note, listing:listings(title, slug), place:places(name, slug), event:events(title, slug), business:business_profiles(name, slug)",
    )
    .eq("reporter_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`Lecture des signalements impossible : ${error.message}`);
  return reportSchema.parse(data);
}

const requestSchema = z.array(
  z.object({
    id: z.uuid(),
    kind: z.enum(["contact", "devis"]),
    status: z.enum(["new", "read", "replied", "archived"]),
    created_at: z.string(),
    sender_name: z.string(),
    sender_id: z.uuid().nullable(),
    recipient_id: z.uuid(),
    business: z.object({ name: z.string() }).nullable(),
    listing: z.object({ title: z.string() }).nullable(),
  }),
);
export type MyContactRequest = z.infer<typeof requestSchema>[number];

/** Demandes de contact et de devis envoyées ou reçues. */
export async function listMyContactRequests(userId: string): Promise<{ sent: MyContactRequest[]; received: MyContactRequest[] }> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("contact_requests")
    .select("id, kind, status, created_at, sender_name, sender_id, recipient_id, business:business_profiles(name), listing:listings(title)")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`Lecture des demandes impossible : ${error.message}`);
  const rows = requestSchema.parse(data);
  return { sent: rows.filter((row) => row.sender_id === userId), received: rows.filter((row) => row.recipient_id === userId) };
}

const preferencesSchema = z.object({
  notification_channels: z.unknown(),
  show_public_name: z.boolean(),
  show_member_since: z.boolean(),
  show_listing_count: z.boolean(),
  search_indexing: z.boolean(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
const DEFAULT_PREFERENCES: Preferences = { notification_channels: {}, show_public_name: true, show_member_since: true, show_listing_count: true, search_indexing: true };

export async function getPreferences(userId: string): Promise<Preferences> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("notification_channels, show_public_name, show_member_since, show_listing_count, search_indexing")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Lecture des préférences impossible : ${error.message}`);
  return data ? preferencesSchema.parse(data) : DEFAULT_PREFERENCES;
}

const notificationSchema = z.array(
  z.object({ id: z.uuid(), type: z.string(), title: z.string(), body: z.string().nullable(), link: z.string().nullable(), created_at: z.string(), read_at: z.string().nullable() }),
);
export type DashboardNotification = z.infer<typeof notificationSchema>[number];

export async function listNotifications(userId: string, limit = 50): Promise<DashboardNotification[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Lecture des notifications impossible : ${error.message}`);
  return notificationSchema.parse(data);
}

const consentSchema = z.array(z.object({ kind: z.string(), granted: z.boolean(), document_version: z.string(), created_at: z.string() }));
export type ConsentEntry = z.infer<typeof consentSchema>[number];

/** Historique de mes consentements (jamais modifié : chaque choix ajoute une ligne). */
export async function listConsents(userId: string): Promise<ConsentEntry[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("consents")
    .select("kind, granted, document_version, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Lecture des consentements impossible : ${error.message}`);
  return consentSchema.parse(data);
}
