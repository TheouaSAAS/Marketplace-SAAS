"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getSessionUser } from "@/server/auth";

const suggestionSchema = z.object({
  article: z.uuid(),
  message: z.string().trim().min(10, "Décrivez la correction (10 caractères au moins).").max(3000, "3 000 caractères au maximum."),
});

/** Suggestion de correction d'un article, examinée par l'équipe locale (5 par jour, règle en base). */
export async function suggestCorrectionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("guide"));
  const parsed = suggestionSchema.safeParse({ article: formData.get("article"), message: formData.get("message") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Suggestions momentanément indisponibles.", values: formValues(formData) };

  const { error } = await supabase.from("guide_suggestions").insert({ article_id: parsed.data.article, user_id: user.id, message: parsed.data.message });
  if (error) {
    if (error.code === "CP429" || error.code === "23514") return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Suggestion du guide non enregistrée", { module: "guide", code: error.code });
    return { status: "error", message: "La suggestion n’a pas pu être envoyée. Réessayez.", values: formValues(formData) };
  }
  return { status: "success", message: "Merci : l’équipe locale examinera votre suggestion avant toute modification de l’article." };
}
