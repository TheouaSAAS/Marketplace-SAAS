import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { verificationStatusSchema } from "@/modules/shared/server/schemas";

export const NEIGHBORHOODS_CACHE_TAG = "neighborhoods";

const neighborhoodSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
});

export type NeighborhoodSummary = z.infer<typeof neighborhoodSchema>;

/** Quartiers publics d'une ville, par ordre alphabétique (aucun classement « meilleur »). */
export async function listNeighborhoods(cityId: string): Promise<NeighborhoodSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(NEIGHBORHOODS_CACHE_TAG, `${NEIGHBORHOODS_CACHE_TAG}:${cityId}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("neighborhoods")
    .select("id, slug, name, verification_status, verified_at")
    .eq("city_id", cityId)
    .order("name");
  if (error) throw new Error(`Lecture des quartiers impossible : ${error.message}`);
  return z.array(neighborhoodSchema).parse(data);
}
