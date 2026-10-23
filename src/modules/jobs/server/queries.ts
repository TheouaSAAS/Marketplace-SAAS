import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { LISTINGS_CACHE_TAG } from "@/modules/listings/server/queries";
import { orderByIds } from "@/modules/shared/server/by-ids";
import { single, verificationStatusSchema } from "@/modules/shared/server/schemas";

export const JOBS_PAGE_SIZE = 20;

const jobCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  attributes: z.record(z.string(), z.unknown()),
  contact_name: z.string().nullable(),
  published_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  category: single(z.object({ name: z.string(), slug: z.string() })),
  neighborhood: single(z.object({ name: z.string() }).nullable()),
  organization: single(z.object({ name: z.string() }).nullable()),
  business: single(z.object({ name: z.string(), slug: z.string() }).nullable()),
});

export type JobCardData = z.infer<typeof jobCardSchema>;

const JOB_COLUMNS =
  "id, slug, title, attributes, contact_name, published_at, expires_at, verification_status, verified_at, category:categories(name, slug), neighborhood:neighborhoods(name), organization:organizations(name), business:business_profiles(name, slug)";

/** Offres publiées par identifiants, dans l'ordre donné (résultats de recherche). */
export async function listJobsByIds(ids: readonly string[]): Promise<JobCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LISTINGS_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase || ids.length === 0) return [];
  const { data, error } = await supabase.from("listings").select(JOB_COLUMNS).eq("status", "published").in("id", [...ids]);
  if (error) throw new Error(`Lecture des offres impossible : ${error.message}`);
  return orderByIds(z.array(jobCardSchema).parse(data), ids);
}

const myApplicationSchema = z.object({
  id: z.uuid(),
  status: z.enum(["submitted", "viewed", "shortlisted", "rejected", "withdrawn"]),
  message: z.string(),
  created_at: z.string(),
  listing: single(z.object({ title: z.string(), slug: z.string() }).nullable()),
});

export type MyApplication = z.infer<typeof myApplicationSchema>;

/** Candidatures de la personne connectée (privées : règles d'accès de la base). */
export async function listMyApplications(userId: string): Promise<MyApplication[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("job_applications")
    .select("id, status, message, created_at, listing:listings(title, slug)")
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Lecture de vos candidatures impossible : ${error.message}`);
  return z.array(myApplicationSchema).parse(data);
}

const receivedSchema = z.object({
  id: z.uuid(),
  listing_id: z.uuid(),
  listing_title: z.string(),
  listing_slug: z.string(),
  applicant_id: z.uuid(),
  applicant_name: z.string(),
  message: z.string(),
  status: myApplicationSchema.shape.status,
  created_at: z.string(),
});

export type ReceivedApplication = z.infer<typeof receivedSchema>;

/** Candidatures reçues sur les offres que la personne gère (elle ou son organisation). */
export async function listReceivedApplications(): Promise<ReceivedApplication[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("received_applications");
  if (error) throw new Error(`Lecture des candidatures reçues impossible : ${error.message}`);
  return z.array(receivedSchema).parse(data);
}

/** La personne connectée a-t-elle déjà candidaté à cette offre ? */
export async function getMyApplicationStatus(listingId: string, userId: string): Promise<string | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from("job_applications").select("status").eq("listing_id", listingId).eq("applicant_id", userId).maybeSingle();
  return data?.status ?? null;
}

const candidateSchema = z.object({
  user_id: z.uuid(),
  headline: z.string(),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  domains: z.array(z.string()),
  experience: z.string().nullable(),
  available: z.boolean(),
  visibility: z.enum(["private", "employers", "public"]),
  share_contact: z.boolean(),
  updated_at: z.string(),
  neighborhood_id: z.uuid().nullable(),
});

export type CandidateProfile = z.infer<typeof candidateSchema>;

const CANDIDATE_COLUMNS = "user_id, headline, summary, skills, domains, experience, available, visibility, share_contact, updated_at, neighborhood_id";

/** Profil candidat de la personne connectée, avec ses coordonnées (lues par fonction : jamais directement). */
export async function getMyCandidateProfile(userId: string): Promise<(CandidateProfile & { contact_email: string | null; contact_phone: string | null }) | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const [profile, contact] = await Promise.all([
    supabase.from("candidate_profiles").select(CANDIDATE_COLUMNS).eq("user_id", userId).maybeSingle(),
    supabase.rpc("my_candidate_contact"),
  ]);
  if (profile.error) throw new Error(`Lecture du profil candidat impossible : ${profile.error.message}`);
  if (!profile.data) return null;
  const contacts = z.array(z.object({ contact_email: z.string().nullable(), contact_phone: z.string().nullable() })).parse(contact.data ?? []);
  return { ...candidateSchema.parse(profile.data), contact_email: contacts[0]?.contact_email ?? null, contact_phone: contacts[0]?.contact_phone ?? null };
}

/** Profils visibles par la personne connectée (publics, ou « employeurs » pour un compte employeur), disponibles d'abord. */
export async function listVisibleCandidates(): Promise<CandidateProfile[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select(CANDIDATE_COLUMNS)
    .neq("visibility", "private")
    .order("available", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Lecture des profils impossible : ${error.message}`);
  return z.array(candidateSchema).parse(data);
}

const pendingSchema = jobCardSchema.extend({ description: z.string(), created_at: z.string(), owner_id: z.uuid() });

/** File de modération des offres et opportunités (équipe ; règles d'accès de la base). */
export async function listPendingJobs(categoryIds: string[]): Promise<z.infer<typeof pendingSchema>[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase || categoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from("listings")
    .select(`${JOB_COLUMNS}, description, created_at, owner_id`)
    .eq("status", "pending")
    .in("category_id", categoryIds)
    .order("created_at")
    .limit(100);
  if (error) throw new Error(`Lecture de la file de modération impossible : ${error.message}`);
  return z.array(pendingSchema).parse(data);
}

const myOfferSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status: z.enum(["draft", "pending", "published", "rejected", "expired", "archived"]),
  availability_status: z.enum(["available", "reserved", "unavailable", "unknown"]),
  rejection_reason: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  category: single(z.object({ name: z.string() })),
});

export type MyOffer = z.infer<typeof myOfferSchema>;

/** Offres et opportunités publiées par la personne connectée, tous statuts. */
export async function listMyOffers(userId: string, categoryIds: string[]): Promise<MyOffer[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase || categoryIds.length === 0) return [];
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, title, status, availability_status, rejection_reason, expires_at, created_at, category:categories(name)")
    .eq("owner_id", userId)
    .in("category_id", categoryIds)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Lecture de vos offres impossible : ${error.message}`);
  return z.array(myOfferSchema).parse(data);
}
