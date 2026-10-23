import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { orderByIds } from "@/modules/shared/server/by-ids";
import { categoryRefSchema, neighborhoodRefSchema, single, verificationStatusSchema } from "@/modules/shared/server/schemas";
import { completeness } from "../domain/pro";

export const BUSINESSES_CACHE_TAG = "businesses";

const businessCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  verification_status: verificationStatusSchema,
  verified_at: z.string().nullable(),
  updated_at: z.string(),
  services: z.array(z.string()),
  service_area: z.string().nullable(),
  accepts_quotes: z.boolean(),
  availability_note: z.string().nullable(),
  availability_declared_at: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  opening_hours: z.unknown().nullable(),
  photos: z.array(z.object({ count: z.number() })),
  category: single(categoryRefSchema.nullable()),
  neighborhood: single(neighborhoodRefSchema),
});

export type BusinessCardData = Omit<z.infer<typeof businessCardSchema>, "photos" | "phone" | "whatsapp" | "email" | "website" | "opening_hours"> & {
  /** Badges calculés : profil complété (rubriques remplies), sponsorisé (campagne active), vérification demandée. */
  complete: boolean;
  sponsored: boolean;
  verificationPending: boolean;
};

const badgeRowsSchema = z.array(z.object({ business_id: z.uuid(), sponsored: z.boolean(), verification_pending: z.boolean() }));

/**
 * Fiches professionnelles publiées par identifiants, dans l'ordre donné, avec
 * leurs badges. Colonnes publiques uniquement (l'adresse et la position exacte
 * sont illisibles par l'API) ; seules les photos publiées comptent.
 */
export async function listBusinessesByIds(ids: readonly string[]): Promise<BusinessCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(BUSINESSES_CACHE_TAG);

  const supabase = createPublicSupabaseClient();
  if (!supabase || ids.length === 0) return [];
  const [{ data, error }, badges] = await Promise.all([
    supabase
      .from("business_profiles")
      .select(
        "id, slug, name, description, verification_status, verified_at, updated_at, services, service_area, accepts_quotes, availability_note, availability_declared_at, phone, whatsapp, email, website, opening_hours, photos:images(count), category:categories(name, slug, icon), neighborhood:neighborhoods(name)",
      )
      .eq("status", "published")
      .eq("photos.bucket", "media")
      .in("id", [...ids]),
    supabase.rpc("business_public_badges", { p_ids: [...ids] }),
  ]);
  if (error) throw new Error(`Lecture des professionnels impossible : ${error.message}`);
  const flags = new Map(badgeRowsSchema.parse(badges.data ?? []).map((row) => [row.business_id, row]));
  const cards = z
    .array(businessCardSchema)
    .parse(data)
    .map(({ photos, phone, whatsapp, email, website, opening_hours, ...card }) => ({
      ...card,
      complete: completeness({ ...card, phone, whatsapp, email, website, opening_hours, photoCount: photos[0]?.count ?? 0 }).complete,
      sponsored: flags.get(card.id)?.sponsored ?? false,
      verificationPending: flags.get(card.id)?.verification_pending ?? false,
    }));
  return orderByIds(cards, ids);
}
