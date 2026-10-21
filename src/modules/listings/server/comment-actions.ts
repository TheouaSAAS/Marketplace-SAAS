"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getSessionUser } from "@/server/auth";

const commentSchema = z.object({
  annonce: z.uuid(),
  parent: z.uuid().optional(),
  texte: z.string().trim().min(2, "Écrivez au moins 2 caractères.").max(1000, "1 000 caractères au maximum."),
});

/** Codes de refus de la base dont le message est destiné au public. */
const READABLE = new Set(["CP429", "23514", "42501"]);

/**
 * Publie un commentaire (ou la réponse de l'annonceur). La base vérifie que
 * l'annonce accepte encore les commentaires, refuse les coordonnées et limite
 * le nombre de commentaires par heure.
 */
export async function addCommentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("search"));
  const parsed = commentSchema.safeParse({
    annonce: formData.get("annonce"),
    parent: formData.get("parent") || undefined,
    texte: formData.get("texte"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Le commentaire n’est pas valide.",
      fieldErrors: { texte: parsed.error.issues[0]?.message ?? "" },
      values: formValues(formData),
    };
  }

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Commentaires momentanément indisponibles." };

  const { error } = await supabase.from("listing_comments").insert({
    listing_id: parsed.data.annonce,
    author_id: user.id,
    parent_id: parsed.data.parent ?? null,
    body: parsed.data.texte,
  });
  if (error) {
    if (READABLE.has(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Commentaire non publié", { module: "annonce", code: error.code });
    return { status: "error", message: "Le commentaire n’a pas pu être publié. Réessayez.", values: formValues(formData) };
  }
  revalidatePath(back);
  return { status: "success", message: "Commentaire publié." };
}

const statusSchema = z.object({
  commentaire: z.uuid(),
  statut: z.enum(["deleted", "hidden", "visible"]),
});

/** Supprimer son commentaire, ou (annonceur) le masquer / le réafficher. Droits vérifiés par la base. */
export async function setCommentStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("search"));
  const parsed = statusSchema.safeParse({ commentaire: formData.get("commentaire"), statut: formData.get("statut") });
  if (!parsed.success) return { status: "error", message: "Action invalide." };

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Commentaires momentanément indisponibles." };

  const { error } = await supabase.from("listing_comments").update({ status: parsed.data.statut }).eq("id", parsed.data.commentaire);
  if (error) {
    if (READABLE.has(error.code)) return { status: "error", message: error.message };
    logger.error("Statut de commentaire non modifié", { module: "annonce", code: error.code });
    return { status: "error", message: "L’action a échoué. Réessayez." };
  }
  revalidatePath(back);
  return { status: "success", message: parsed.data.statut === "deleted" ? "Commentaire supprimé." : "Commentaire mis à jour." };
}
