import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { APPEAL_TARGET_KEYS, type MyAppeal } from "../domain/appeals";

const rowSchema = z.object({
  target_type: z.enum(APPEAL_TARGET_KEYS),
  target_id: z.uuid(),
  status: z.enum(["pending", "accepted", "rejected"]),
  decision_note: z.string().nullable(),
});

/** Mes recours, du plus récent au plus ancien. */
export async function listMyAppeals(): Promise<MyAppeal[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("appeals").select("target_type, target_id, status, decision_note").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Recours : ${error.code}`);
  return z
    .array(rowSchema)
    .parse(data)
    .map((row) => ({ targetType: row.target_type, targetId: row.target_id, status: row.status, decisionNote: row.decision_note }));
}

const adminSchema = z.object({
  id: z.uuid(),
  target_type: z.enum(APPEAL_TARGET_KEYS),
  target_id: z.uuid(),
  title: z.string(),
  message: z.string(),
  status: z.enum(["pending", "accepted", "rejected"]),
  decision_note: z.string().nullable(),
  created_at: z.string(),
  decided_at: z.string().nullable(),
  author_name: z.string().nullable(),
  user_id: z.uuid(),
});
export type AdminAppeal = z.infer<typeof adminSchema>;

/** File des recours (équipe de modération). */
export async function listAppeals(pending: boolean): Promise<AdminAppeal[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) throw new Error("Base indisponible");
  const { data, error } = await supabase.rpc("admin_appeals", { p_pending: pending });
  if (error) throw new Error(`Recours : ${error.code}`);
  return z.array(adminSchema).parse(data);
}
