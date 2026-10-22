import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { single } from "@/modules/shared/server/schemas";
import { CLAIM_STATUSES, CLAIMANT_ROLES, type ClaimantRole, type ClaimStatus } from "../domain/claims";

const claimSchema = z.object({
  id: z.uuid(),
  created_at: z.string(),
  status: z.enum(Object.keys(CLAIM_STATUSES) as [ClaimStatus, ...ClaimStatus[]]),
  claimant_role: z.enum(Object.keys(CLAIMANT_ROLES) as [ClaimantRole, ...ClaimantRole[]]),
  message: z.string(),
  evidence: z.string(),
  phone: z.string(),
  decision_note: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  place: single(z.object({ name: z.string(), slug: z.string() })),
  claimant: single(z.object({ display_name: z.string().nullable() }).nullable()),
});

export type PlaceClaim = z.infer<typeof claimSchema>;

const COLUMNS =
  "id, created_at, status, claimant_role, message, evidence, phone, decision_note, reviewed_at, place:places(name, slug), claimant:profiles!place_claims_claimant_id_fkey(display_name)";

/** Revendications en attente (équipe locale ; règles d'accès de la base), les plus anciennes d'abord. */
export async function listPendingClaims(): Promise<PlaceClaim[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("place_claims").select(COLUMNS).eq("status", "pending").order("created_at").limit(100);
  if (error) throw new Error(`Lecture des revendications impossible : ${error.message}`);
  return z.array(claimSchema).parse(data);
}

/** Revendications de la personne connectée, avec la décision et son motif. */
export async function listMyClaims(userId: string): Promise<PlaceClaim[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("place_claims").select(COLUMNS).eq("claimant_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error(`Lecture des revendications impossible : ${error.message}`);
  return z.array(claimSchema).parse(data);
}
