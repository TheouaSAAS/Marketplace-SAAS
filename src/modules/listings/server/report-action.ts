"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getSessionUser } from "@/server/auth";
import { REPORT_REASON_KEYS } from "../domain/report-reasons";

const reportSchema = z
  .object({
    annonce: z.uuid().optional(),
    commentaire: z.uuid().optional(),
    professionnel: z.uuid().optional(),
    lieu: z.uuid().optional(),
    article: z.uuid().optional(),
    motif: z.enum(REPORT_REASON_KEYS, { error: "Choisissez un motif." }),
    details: z.string().trim().max(2000, "2 000 caractères au maximum.").optional(),
  })
  .refine((value) => [value.annonce, value.commentaire, value.professionnel, value.lieu, value.article].filter(Boolean).length === 1, { message: "Contenu signalé introuvable." });

/**
 * Signale une annonce, un commentaire, une fiche professionnelle, une vitrine ou un article du guide à l'équipe de modération. Un seul
 * signalement ouvert par personne et par contenu ; nombre limité par heure
 * (règles en base).
 */
export async function reportContentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("search"));
  const parsed = reportSchema.safeParse({
    annonce: formData.get("annonce") || undefined,
    commentaire: formData.get("commentaire") || undefined,
    professionnel: formData.get("professionnel") || undefined,
    lieu: formData.get("lieu") || undefined,
    article: formData.get("article") || undefined,
    motif: formData.get("motif"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: "error",
      message: issue?.message ?? "Signalement invalide.",
      fieldErrors: issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined,
      values: formValues(formData),
    };
  }

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Signalement momentanément indisponible." };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    listing_id: parsed.data.annonce ?? null,
    comment_id: parsed.data.commentaire ?? null,
    business_id: parsed.data.professionnel ?? null,
    place_id: parsed.data.lieu ?? null,
    article_id: parsed.data.article ?? null,
    reason: parsed.data.motif,
    details: parsed.data.details ?? null,
  });
  if (error) {
    if (error.code === "23505") return { status: "success", message: "Vous avez déjà signalé ce contenu : l’équipe l’examine." };
    if (error.code === "CP429") return { status: "error", message: error.message };
    logger.error("Signalement non enregistré", { module: "moderation", code: error.code });
    return { status: "error", message: "Le signalement n’a pas pu être envoyé. Réessayez.", values: formValues(formData) };
  }
  return { status: "success", message: "Merci : votre signalement est transmis à l’équipe de modération." };
}
