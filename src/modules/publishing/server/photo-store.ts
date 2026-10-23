import "server-only";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSessionSupabaseClient } from "@/lib/supabase/server";

/**
 * Photos d'une annonce ou d'une page professionnelle : privées jusqu'à la
 * publication (stockage `private-media`, adresses signées pour l'auteur,
 * l'équipe habilitée et la modération), puis copiées dans le stockage public.
 */

export type PhotoTargetKind = "annonce" | "pro";
export interface PhotoTarget {
  kind: PhotoTargetKind;
  id: string;
}

/** Colonne de rattachement et dossier de stockage de chaque cible. */
export const PHOTO_TARGETS = {
  annonce: { column: "listing_id", folder: "annonces" },
  pro: { column: "business_id", folder: "pros" },
} as const;

const photoSchema = z.object({
  id: z.uuid(),
  storage_path: z.string(),
  bucket: z.enum(["media", "private-media"]),
  alt_text: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  content_hash: z.string().nullable(),
});

export interface DraftPhoto {
  id: string;
  url: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  hash: string | null;
  /** Mêmes octets dans une autre annonce de l'auteur / d'un autre compte (annonces seulement). */
  ownDuplicates: number;
  otherDuplicates: number;
}

export async function listPhotos(target: PhotoTarget): Promise<DraftPhoto[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const [{ data, error }, duplicates] = await Promise.all([
    supabase
      .from("images")
      .select("id, storage_path, bucket, alt_text, width, height, content_hash")
      .eq(PHOTO_TARGETS[target.kind].column, target.id)
      .order("sort_order")
      .order("created_at"),
    target.kind === "annonce" ? supabase.rpc("listing_image_duplicates", { p_listing: target.id }) : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(`Lecture des photos impossible : ${error.message}`);
  const photos = z.array(photoSchema).parse(data);
  const privatePaths = photos.filter((photo) => photo.bucket === "private-media").map((photo) => photo.storage_path);
  const signed = privatePaths.length ? ((await supabase.storage.from("private-media").createSignedUrls(privatePaths, 3600)).data ?? []) : [];
  const signedByPath = new Map(signed.map((item) => [item.path, item.signedUrl]));
  const duplicateById = new Map((duplicates.data ?? []).map((item) => [item.image_id, item]));
  return photos.map((photo) => ({
    id: photo.id,
    url: photo.bucket === "private-media" ? (signedByPath.get(photo.storage_path) ?? null) : supabase.storage.from("media").getPublicUrl(photo.storage_path).data.publicUrl,
    alt: photo.alt_text ?? "",
    width: photo.width,
    height: photo.height,
    hash: photo.content_hash,
    ownDuplicates: duplicateById.get(photo.id)?.own_matches ?? 0,
    otherDuplicates: duplicateById.get(photo.id)?.other_matches ?? 0,
  }));
}

/**
 * Copie les photos privées dans le stockage public (même chemin) et met à jour
 * leur fiche. Clé secrète : à n'appeler qu'après avoir vérifié le rôle de modérateur.
 */
export async function promotePhotos(target: PhotoTarget): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  if (!admin) return false;
  const { data: photos, error } = await admin.from("images").select("id, storage_path").eq(PHOTO_TARGETS[target.kind].column, target.id).eq("bucket", "private-media");
  if (error) return false;
  for (const photo of photos ?? []) {
    const copy = await admin.storage.from("private-media").copy(photo.storage_path, photo.storage_path, { destinationBucket: "media" });
    if (copy.error && !/exists/i.test(copy.error.message)) {
      logger.error("Photo non copiée", { module: "photos", error: copy.error.message });
      return false;
    }
    const { error: update } = await admin.from("images").update({ bucket: "media" }).eq("id", photo.id);
    if (update) return false;
    await admin.storage.from("private-media").remove([photo.storage_path]);
  }
  return true;
}
