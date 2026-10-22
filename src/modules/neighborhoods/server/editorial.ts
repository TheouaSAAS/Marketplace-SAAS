import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { verificationStatusSchema } from "@/modules/shared/server/schemas";

/*
 * Lectures de l'administration des quartiers (équipe locale) : tous les
 * quartiers, y compris inactifs, et l'historique des périmètres. Les règles
 * d'accès de la base les réservent aux éditeurs locaux et administrateurs.
 */

const rowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  alt_names: z.array(z.string()),
  description: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  source_id: z.uuid().nullable(),
  steward_id: z.uuid().nullable(),
  is_active: z.boolean(),
  boundary_validated_at: z.string().nullable(),
  updated_at: z.string(),
});

export type EditableNeighborhood = z.infer<typeof rowSchema>;

const COLUMNS = "id, slug, name, alt_names, description, verification_status, verified_at, source_id, steward_id, is_active, boundary_validated_at, updated_at";

export async function listNeighborhoodsForEditing(cityId: string): Promise<EditableNeighborhood[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("neighborhoods").select(COLUMNS).eq("city_id", cityId).order("name");
  if (error) throw new Error(`Lecture des quartiers impossible : ${error.message}`);
  return z.array(rowSchema).parse(data);
}

export async function getNeighborhoodForEditing(cityId: string, slug: string): Promise<EditableNeighborhood | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("neighborhoods").select(COLUMNS).eq("city_id", cityId).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Lecture du quartier impossible : ${error.message}`);
  return data ? rowSchema.parse(data) : null;
}

const historySchema = z.object({
  id: z.uuid(),
  status: z.enum(["draft", "validated", "rejected", "superseded"]),
  note: z.string().nullable(),
  review_note: z.string().nullable(),
  proposed_at: z.string(),
  reviewed_at: z.string().nullable(),
  source_title: z.string().nullable(),
  area_km2: z.number(),
  geojson: z.string(),
});

export type BoundaryVersion = z.infer<typeof historySchema>;

export async function listBoundaryHistory(neighborhoodId: string): Promise<BoundaryVersion[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("neighborhood_boundary_history", { p_neighborhood: neighborhoodId });
  if (error) throw new Error(`Lecture des périmètres impossible : ${error.message}`);
  return z.array(historySchema).parse(data);
}
