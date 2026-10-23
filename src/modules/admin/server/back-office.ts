import "server-only";
import { z } from "zod";
import { USER_ROLES, type UserRole } from "@/domain/roles";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { OVERVIEW_KEYS, REPORT_TARGET_TYPES, type Overview, type QualityKind } from "../domain/back-office";

/**
 * Lectures du back-office. Chaque fonction SQL vérifie elle-même le rôle de
 * la personne connectée (modération, équipe locale ou administration).
 */

async function client() {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) throw new Error("Base indisponible");
  return supabase;
}

function fail(scope: string, error: { code: string; message: string }): never {
  throw new Error(`${scope} : ${error.code} ${error.message}`);
}

export async function getOverview(): Promise<Overview> {
  const { data, error } = await (await client()).rpc("admin_overview");
  if (error) fail("Tableau de bord", error);
  const raw = z.record(z.string(), z.coerce.number()).parse(data);
  return Object.fromEntries(OVERVIEW_KEYS.map((key) => [key, raw[key] ?? 0])) as Overview;
}

const reportSchema = z.object({
  id: z.uuid(),
  reason: z.string(),
  details: z.string().nullable(),
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
  created_at: z.string(),
  handled_at: z.string().nullable(),
  resolution_note: z.string().nullable(),
  target_type: z.enum(REPORT_TARGET_TYPES),
  target_id: z.uuid().nullable(),
  target_title: z.string(),
  target_slug: z.string().nullable(),
  target_parent_type: z.string().nullable(),
  target_parent_slug: z.string().nullable(),
  target_status: z.string().nullable(),
  target_owner: z.uuid().nullable(),
  target_reports: z.number(),
});
export type AdminReport = z.infer<typeof reportSchema>;

export async function listReports(open: boolean): Promise<AdminReport[]> {
  const { data, error } = await (await client()).rpc("admin_reports", { p_open: open });
  if (error) fail("Signalements", error);
  return z.array(reportSchema).parse(data);
}

const accountSchema = z.object({
  id: z.uuid(),
  display_name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  is_suspended: z.boolean(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  listings: z.number(),
  organizations: z.number(),
  reports_against: z.number(),
});
export type AdminAccount = z.infer<typeof accountSchema>;

export async function listAccounts(filters: { query?: string; role?: UserRole; suspended?: boolean }): Promise<AdminAccount[]> {
  const { data, error } = await (await client()).rpc("admin_accounts", {
    p_query: filters.query || undefined,
    p_role: filters.role,
    p_suspended: filters.suspended,
  });
  if (error) fail("Comptes", error);
  return z.array(accountSchema).parse(data);
}

const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  kind: z.string(),
  is_suspended: z.boolean(),
  created_at: z.string(),
  members: z.number(),
  pages: z.number(),
  listings: z.number(),
});
export type AdminOrganization = z.infer<typeof organizationSchema>;

export async function listOrganizations(query?: string): Promise<AdminOrganization[]> {
  const { data, error } = await (await client()).rpc("admin_organizations", { p_query: query || undefined });
  if (error) fail("Organisations", error);
  return z.array(organizationSchema).parse(data);
}

const auditSchema = z.object({
  id: z.number(),
  created_at: z.string(),
  actor_id: z.uuid().nullable(),
  actor_name: z.string().nullable(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.uuid().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
});
export type AuditEntry = z.infer<typeof auditSchema>;

export async function listAuditEntries(prefix?: string): Promise<AuditEntry[]> {
  const { data, error } = await (await client()).rpc("admin_audit_entries", { p_action: prefix || undefined, p_limit: 100 });
  if (error) fail("Journal", error);
  return z.array(auditSchema).parse(data);
}

const revisionSchema = z.object({
  id: z.number(),
  changed_at: z.string(),
  changed_by: z.uuid().nullable(),
  author_name: z.string().nullable(),
  entity_type: z.string(),
  entity_id: z.uuid(),
  action: z.enum(["insert", "update", "delete"]),
  reason: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
});
export type Revision = z.infer<typeof revisionSchema>;

export async function listRevisions(filters: { type?: string; id?: string }): Promise<Revision[]> {
  const { data, error } = await (await client()).rpc("admin_revisions", { p_entity_type: filters.type || undefined, p_entity_id: filters.id || undefined, p_limit: 50 });
  if (error) fail("Historique", error);
  return z.array(revisionSchema).parse(data);
}

const qualitySchema = z.object({
  entity_type: z.string(),
  entity_id: z.uuid(),
  title: z.string(),
  slug: z.string().nullable(),
  status: z.string().nullable(),
  verification_status: z.string().nullable(),
  since: z.string().nullable(),
  detail: z.string().nullable(),
});
export type QualityItem = z.infer<typeof qualitySchema>;

export async function listQualityItems(kind: QualityKind): Promise<QualityItem[]> {
  const { data, error } = await (await client()).rpc("quality_items", { p_kind: kind });
  if (error) fail("Qualité", error);
  return z.array(qualitySchema).parse(data);
}

const duplicateSchema = z.object({
  a_id: z.uuid(),
  a_name: z.string(),
  a_slug: z.string(),
  a_status: z.string(),
  b_id: z.uuid(),
  b_name: z.string(),
  b_slug: z.string(),
  b_status: z.string(),
  similarity: z.number(),
  distance_m: z.number().nullable(),
  same_phone: z.boolean(),
});
export type DuplicatePair = z.infer<typeof duplicateSchema>;

export async function listDuplicates(): Promise<DuplicatePair[]> {
  const { data, error } = await (await client()).rpc("place_duplicates");
  if (error) fail("Doublons", error);
  return z.array(duplicateSchema).parse(data);
}

const sourceSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  title: z.string(),
  publisher: z.string().nullable(),
  url: z.string().nullable(),
  collected_at: z.string(),
  created_at: z.string(),
});
export type Source = z.infer<typeof sourceSchema>;

export async function listSources(): Promise<Source[]> {
  const { data, error } = await (await client())
    .from("sources")
    .select("id, kind, title, publisher, url, collected_at, created_at")
    .order("collected_at", { ascending: false })
    .limit(200);
  if (error) fail("Sources", error);
  return z.array(sourceSchema).parse(data);
}

const campaignSchema = z.object({
  id: z.uuid(),
  placement: z.enum(["home", "search", "category", "map"]),
  status: z.enum(["draft", "pending_payment", "active", "paused", "ended", "rejected"]),
  starts_at: z.string(),
  ends_at: z.string(),
  budget_xof: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  listing: z.object({ title: z.string() }).nullable(),
  place: z.object({ name: z.string() }).nullable(),
  event: z.object({ title: z.string() }).nullable(),
  business: z.object({ name: z.string() }).nullable(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export async function listCampaigns(): Promise<Campaign[]> {
  const { data, error } = await (await client())
    .from("sponsored_campaigns")
    .select("id, placement, status, starts_at, ends_at, budget_xof, impressions, clicks, listing:listings(title), place:places(name), event:events(title), business:business_profiles(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail("Campagnes", error);
  return z.array(campaignSchema).parse(data);
}

const subscriptionSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "active", "past_due", "canceled", "expired"]),
  current_period_end: z.string().nullable(),
  created_at: z.string(),
  plan: z.object({ name: z.string() }).nullable(),
  business: z.object({ name: z.string() }).nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export async function listSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await (await client())
    .from("subscriptions")
    .select("id, status, current_period_end, created_at, plan:plans(name), business:business_profiles(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail("Abonnements", error);
  return z.array(subscriptionSchema).parse(data);
}

const usageSchema = z.object({ feature: z.string(), calls: z.number(), input_tokens: z.coerce.number(), output_tokens: z.coerce.number(), cost_usd: z.coerce.number() });
export type AiUsageLine = z.infer<typeof usageSchema>;

export async function listAiUsage(): Promise<AiUsageLine[]> {
  const { data, error } = await (await client()).rpc("ai_usage_summary");
  if (error) fail("Consommation IA", error);
  return z.array(usageSchema).parse(data);
}

/** Documents de la base de connaissances par type et statut (lisibles par l'équipe locale). */
export async function knowledgeCounts(): Promise<{ type: string; verified: number; other: number }[]> {
  const { data, error } = await (await client()).from("knowledge_documents").select("entity_type, verification_status").limit(5000);
  if (error) fail("Base de connaissances", error);
  const counts = new Map<string, { type: string; verified: number; other: number }>();
  for (const row of data ?? []) {
    const line = counts.get(row.entity_type) ?? { type: row.entity_type, verified: 0, other: 0 };
    if (row.verification_status === "verified") line.verified += 1;
    else line.other += 1;
    counts.set(row.entity_type, line);
  }
  return [...counts.values()];
}
