import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { neighborhoodRefSchema, single, verificationStatusSchema } from "@/modules/shared/server/schemas";

export const EVENTS_CACHE_TAG = "events";

const eventCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  schedule_status: z.enum(["scheduled", "postponed", "cancelled"]),
  is_free: z.boolean(),
  price_min: z.number().nullable(),
  organizer_name: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  category: single(z.object({ name: z.string() })),
  neighborhood: single(neighborhoodRefSchema),
});

export type EventCardData = z.infer<typeof eventCardSchema>;

/** Début de la journée courante (UTC = heure d'Abidjan). */
function startOfToday(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Prochains événements publiés d'une ville, du plus proche au plus lointain.
 * Un événement terminé n'est jamais renvoyé ; un événement annulé l'est (pour
 * être signalé comme tel). La date de référence est fixée à la mise en cache,
 * d'où une durée de cache courte.
 */
export async function listUpcomingEvents(cityId: string, limit = 4): Promise<EventCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(EVENTS_CACHE_TAG, `${EVENTS_CACHE_TAG}:${cityId}`);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, slug, title, starts_at, ends_at, schedule_status, is_free, price_min, organizer_name, verification_status, verified_at, category:categories(name), neighborhood:neighborhoods(name)",
    )
    .eq("city_id", cityId)
    .eq("status", "published")
    // Pas encore terminé : fin future, ou sans fin et commencé aujourd'hui ou plus tard.
    .or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${startOfToday()})`)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Lecture des événements impossible : ${error.message}`);
  return z.array(eventCardSchema).parse(data);
}
