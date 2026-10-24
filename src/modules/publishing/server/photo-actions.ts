"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { isPhotoType, isSha256, PHOTO_MAX_BYTES, PHOTO_TYPES, sniffPhotoType } from "../domain/photos";
import { PHOTO_TARGETS } from "./photo-store";

async function session() {
  const user = await getSessionUser();
  if (!user) redirect(href("login"));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) throw new Error("Base indisponible");
  return { user, supabase };
}

const SHOWN_CODES = ["23514", "42501"];

function failure(error: { code: string; message: string }, fallback: string): { ok: false; message: string } {
  if (SHOWN_CODES.includes(error.code)) return { ok: false, message: error.message };
  logger.error(fallback, { module: "photos", code: error.code });
  return { ok: false, message: `${fallback}. Réessayez.` };
}

const photoSchema = z.object({
  target: z.enum(["annonce", "pro"]).default("annonce"),
  id: z.uuid(),
  path: z.string().max(300),
  type: z.string(),
  bytes: z.number().int().positive().max(PHOTO_MAX_BYTES),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  hash: z.string(),
  alt: z.string().trim().max(200).optional(),
});

type Supabase = Awaited<ReturnType<typeof session>>["supabase"];

/**
 * Contrôle du fichier réellement déposé (et non de ce qu'annonce le
 * navigateur) : taille, signature d'image, empreinte. Un fichier non conforme
 * est supprimé du stockage.
 */
async function verifyStoredPhoto(supabase: Supabase, path: string, declared: { type: string; bytes: number; hash: string }): Promise<string | null> {
  const { data, error } = await supabase.storage.from("private-media").download(path);
  if (error || !data) return "La photo déposée est introuvable. Réessayez.";
  if (data.size > PHOTO_MAX_BYTES) return "Photo trop lourde : 5 Mo au plus.";
  const bytes = new Uint8Array(await data.arrayBuffer());
  const real = sniffPhotoType(bytes);
  if (!real) return "Ce fichier n’est pas une image JPEG, PNG ou WebP.";
  if (real !== declared.type) return "Le type du fichier ne correspond pas à son contenu.";
  if (createHash("sha256").update(bytes).digest("hex") !== declared.hash) return "Le fichier a changé pendant l’envoi. Réessayez.";
  return null;
}

export type RegisterPhotoResult = { ok: true; photoId: string; ownDuplicates: number; otherDuplicates: number } | { ok: false; message: string };

/** Enregistre une photo déposée par le navigateur dans le stockage privé ; la base la garde privée et limite leur nombre. */
export async function registerPhotoAction(input: z.input<typeof photoSchema>): Promise<RegisterPhotoResult> {
  const parsed = photoSchema.safeParse(input);
  if (!parsed.success || !isPhotoType(parsed.data.type) || !isSha256(parsed.data.hash)) return { ok: false, message: "Photo invalide." };
  const { user, supabase } = await session();
  const { target, id, path, type, bytes, width, height, hash, alt } = parsed.data;
  const { column, folder } = PHOTO_TARGETS[target];
  const expected = new RegExp(`^${user.id}/${folder}/${id}/[0-9a-f-]{36}\\.${PHOTO_TYPES[type]}$`);
  if (!expected.test(path)) return { ok: false, message: "Emplacement de la photo invalide." };
  const rejected = await verifyStoredPhoto(supabase, path, { type, bytes, hash });
  if (rejected) {
    await supabase.storage.from("private-media").remove([path]);
    return { ok: false, message: rejected };
  }
  const { count } = await supabase.from("images").select("id", { count: "exact", head: true }).eq(column, id);
  const { data, error } = await supabase
    .from("images")
    .insert({ owner_id: user.id, ...(target === "annonce" ? { listing_id: id } : { business_id: id }), storage_path: path, bucket: "private-media", width, height, byte_size: bytes, content_hash: hash, alt_text: alt || null, sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from("private-media").remove([path]);
    return error ? failure(error, "La photo n’a pas pu être ajoutée") : { ok: false, message: "La photo n’a pas pu être ajoutée." };
  }
  if (target !== "annonce") return { ok: true, photoId: data.id, ownDuplicates: 0, otherDuplicates: 0 };
  const { data: duplicates } = await supabase.rpc("listing_image_duplicates", { p_listing: id });
  const mine = duplicates?.find((item) => item.image_id === data.id);
  return { ok: true, photoId: data.id, ownDuplicates: mine?.own_matches ?? 0, otherDuplicates: mine?.other_matches ?? 0 };
}

export async function removePhotoAction(input: { photoId: string }): Promise<{ ok: boolean; message?: string }> {
  const id = z.uuid().safeParse(input.photoId);
  if (!id.success) return { ok: false, message: "Photo introuvable." };
  const { supabase } = await session();
  const { data } = await supabase.from("images").select("storage_path, bucket").eq("id", id.data).maybeSingle();
  if (!data) return { ok: false, message: "Photo introuvable." };
  // Fichier d'abord : l'accès d'un collègue au stockage privé s'appuie sur la fiche de la photo.
  await supabase.storage.from(data.bucket).remove([data.storage_path]);
  const { error } = await supabase.from("images").delete().eq("id", id.data);
  if (error) return failure(error, "La photo n’a pas pu être retirée");
  return { ok: true };
}

export async function updatePhotoAltAction(input: { photoId: string; alt: string }): Promise<{ ok: boolean }> {
  const parsed = z.object({ photoId: z.uuid(), alt: z.string().trim().max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { supabase } = await session();
  const { error } = await supabase.from("images").update({ alt_text: parsed.data.alt || null }).eq("id", parsed.data.photoId);
  return { ok: !error };
}
