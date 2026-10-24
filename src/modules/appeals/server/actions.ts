"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { href } from "@/config/routes";
import { isStaff } from "@/domain/roles";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getCurrentAccount, getSessionUser } from "@/server/auth";
import { APPEAL_TARGET_KEYS } from "../domain/appeals";

const SHOWN = ["23514", "23505", "42501", "P0002", "CP429"];

function databaseError(error: { code: string; message: string }, formData: FormData): FormState {
  if (SHOWN.includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
  logger.error("Recours non enregistré", { module: "recours", code: error.code });
  return { status: "error", message: "Le recours n’a pas pu être enregistré. Réessayez.", values: formValues(formData) };
}

/** Contester une décision : le contenu doit être le sien et refusé, masqué ou suspendu (vérifié en base). */
export async function submitAppealAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      type: z.enum(APPEAL_TARGET_KEYS),
      id: z.uuid(),
      message: z.string().trim().min(10, "Expliquez votre recours (10 caractères au moins).").max(2000, "2 000 caractères au maximum."),
    })
    .safeParse({ type: formData.get("type"), id: formData.get("id"), message: formData.get("message") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const user = await getSessionUser();
  const supabase = await createSessionSupabaseClient();
  if (!user || !supabase) return { status: "error", message: "Connexion requise." };
  const { error } = await supabase.rpc("submit_appeal", { p_type: parsed.data.type, p_id: parsed.data.id, p_message: parsed.data.message });
  if (error) return databaseError(error, formData);
  revalidatePath(safeRedirectPath(formData.get("retour"), href("dashboard")));
  return { status: "success", message: "Recours envoyé : une personne de l’équipe le relira et vous répondra par notification." };
}

/** Décision de l'équipe de modération, motivée et journalisée. */
export async function decideAppealAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      recours: z.uuid(),
      decision: z.enum(["accepter", "refuser"]),
      note: z.string().trim().min(5, "Indiquez la raison (5 caractères au moins).").max(1000, "1 000 caractères au maximum."),
    })
    .safeParse({ recours: formData.get("recours"), decision: formData.get("decision"), note: formData.get("note") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const account = await getCurrentAccount();
  const supabase = await createSessionSupabaseClient();
  if (!account || !isStaff(account.role) || !supabase) return { status: "error", message: "Réservé à l’équipe de modération." };
  const { error } = await supabase.rpc("decide_appeal", { p_appeal: parsed.data.recours, p_accept: parsed.data.decision === "accepter", p_note: parsed.data.note });
  if (error) return databaseError(error, formData);
  revalidatePath(href("adminAppeals"));
  return {
    status: "success",
    message: parsed.data.decision === "accepter" ? "Recours accepté : le contenu est de nouveau examiné ou rétabli, l’auteur est prévenu." : "Recours refusé : l’auteur reçoit votre motif.",
  };
}
