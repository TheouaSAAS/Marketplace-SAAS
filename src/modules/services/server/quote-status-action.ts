"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import type { FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { isQuoteStatus, QUOTE_STATUSES } from "../domain/quote";

/**
 * Change le statut d'une demande de devis reçue. La base n'autorise que le
 * destinataire et refuse toute autre modification que le statut.
 */
export async function updateQuoteStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("demande"));
  const status = formData.get("statut");
  if (!id.success || !isQuoteStatus(status)) return { status: "error", message: "Demande ou statut invalide." };

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: href("quoteRequests") } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Suivi des demandes momentanément indisponible." };

  const { data, error } = await supabase
    .from("contact_requests")
    .update({ status })
    .eq("id", id.data)
    .eq("recipient_id", user.id)
    .select("id");
  if (error) {
    logger.error("Statut de devis non enregistré", { module: "services", code: error.code });
    return { status: "error", message: "Le statut n’a pas pu être enregistré. Réessayez." };
  }
  if (!data?.length) return { status: "error", message: "Cette demande ne vous est pas adressée." };
  revalidatePath(href("quoteRequests"));
  return { status: "success", message: `Statut : ${QUOTE_STATUSES[status].label.toLowerCase()}.` };
}
