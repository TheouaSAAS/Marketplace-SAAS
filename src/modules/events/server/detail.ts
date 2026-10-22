import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { single, verificationStatusSchema } from "@/modules/shared/server/schemas";
import { EVENTS_CACHE_TAG } from "./queries";

const scheduleSchema = z.enum(["scheduled", "postponed", "cancelled"]);
const statusSchema = z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]);

const detailSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  schedule_status: scheduleSchema,
  schedule_note: z.string().nullable(),
  original_starts_at: z.string().nullable(),
  is_free: z.boolean(),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  ticket_url: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_whatsapp: z.string().nullable(),
  contact_email: z.string().nullable(),
  organizer_id: z.uuid(),
  organizer_name: z.string().nullable(),
  address_text: z.string().nullable(),
  status: statusSchema,
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  published_at: z.string().nullable(),
  updated_at: z.string(),
  category: single(z.object({ name: z.string(), slug: z.string() })),
  neighborhood: single(z.object({ name: z.string(), slug: z.string() }).nullable()),
  place: single(z.object({ name: z.string(), slug: z.string() }).nullable()),
  business: single(z.object({ name: z.string(), slug: z.string() }).nullable()),
  source: single(z.object({ title: z.string() }).nullable()),
});

export type EventDetail = z.infer<typeof detailSchema>;

const DETAIL_COLUMNS =
  "id, slug, title, description, starts_at, ends_at, schedule_status, schedule_note, original_starts_at, is_free, price_min, price_max, ticket_url, contact_phone, contact_whatsapp, contact_email, organizer_id, organizer_name, address_text, status, verification_status, verified_at, published_at, updated_at, category:categories(name, slug), neighborhood:neighborhoods(name, slug), place:places(name, slug), business:business_profiles(name, slug), source:sources(title)";

/** Événement publié ; null sinon (archivé 30 jours après la fin, il n’est plus public). */
export async function getPublicEvent(slug: string): Promise<EventDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_CACHE_TAG, `${EVENTS_CACHE_TAG}:${slug}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("events").select(DETAIL_COLUMNS).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error(`Lecture de l’événement impossible : ${error.message}`);
  return data ? detailSchema.parse(data) : null;
}

/** Événement vu par son organisateur ou l'équipe (tous statuts, règles d'accès de la base). */
export async function getEventForSession(slug: string): Promise<EventDetail | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("events").select(DETAIL_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Lecture de l’événement impossible : ${error.message}`);
  return data ? detailSchema.parse(data) : null;
}

const pointSchema = z.array(z.object({ lat: z.number(), lng: z.number(), location_precision: z.enum(["exact", "approximate", "unknown"]) }));

export async function getEventPoint(eventId: string) {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("event_point", { p_event: eventId });
  if (error) throw new Error(`Lecture de la position impossible : ${error.message}`);
  return pointSchema.parse(data)[0] ?? null;
}

/** L'événement est-il dans les favoris de la personne connectée ? */
export async function isFavoriteEvent(eventId: string, userId: string): Promise<boolean> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return false;
  const { data } = await supabase.from("favorites").select("id").eq("user_id", userId).eq("event_id", eventId).maybeSingle();
  return Boolean(data);
}

const managedSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  status: statusSchema,
  schedule_status: scheduleSchema,
  rejection_reason: z.string().nullable(),
  organizer_id: z.uuid(),
  organizer_name: z.string().nullable(),
  created_at: z.string(),
  category: single(z.object({ name: z.string() })),
});

export type ManagedEvent = z.infer<typeof managedSchema>;

const MANAGED_COLUMNS = "id, slug, title, starts_at, ends_at, status, schedule_status, rejection_reason, organizer_id, organizer_name, created_at, category:categories(name)";

/** Événements de l'organisateur connecté, tous statuts. */
export async function listMyEvents(userId: string): Promise<ManagedEvent[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("events").select(MANAGED_COLUMNS).eq("organizer_id", userId).order("starts_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Lecture de vos événements impossible : ${error.message}`);
  return z.array(managedSchema).parse(data);
}

/** File de modération : événements en attente, les plus anciens d'abord (équipe seulement, règles d'accès). */
export async function listPendingEvents(): Promise<(ManagedEvent & { description: string })[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("events")
    .select(`${MANAGED_COLUMNS}, description`)
    .eq("status", "pending")
    .order("created_at")
    .limit(100);
  if (error) throw new Error(`Lecture de la file de modération impossible : ${error.message}`);
  return z.array(managedSchema.extend({ description: z.string() })).parse(data);
}
