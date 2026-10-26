"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getSessionUser } from "@/server/auth";
import { hasAcceptedCharter, recordCharterAcceptance } from "@/modules/trust/server/charter";
import { closedFeatureMessage, isFeatureEnabled } from "@/server/features";

/** Codes de refus de la base dont le message est destiné au public. */
const READABLE = new Set(["CP429", "23514", "42501"]);

/**
 * Affiche une coordonnée que l'annonceur a choisi de partager (téléphone,
 * WhatsApp, e-mail). La base vérifie son accord, l'état de l'annonce et la
 * limite horaire ; la coordonnée n'est renvoyée qu'à la personne connectée.
 */
export async function revealContactAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("search"));
  const listingId = z.uuid().safeParse(formData.get("annonce"));
  const channel = z.enum(["phone", "whatsapp", "email"]).safeParse(formData.get("canal"));
  if (!listingId.success || !channel.success) return { status: "error", message: "Demande invalide." };

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };

  const { data, error } = await supabase.rpc("reveal_listing_contact", { p_listing: listingId.data, p_channel: channel.data });
  if (error) {
    if (READABLE.has(error.code)) return { status: "error", message: error.message };
    logger.error("Coordonnée non affichée", { module: "annonce", code: error.code });
    return { status: "error", message: "La coordonnée n’a pas pu être affichée. Réessayez." };
  }
  return { status: "success", values: { valeur: String(data), canal: channel.data } };
}

const messageSchema = z.object({
  annonce: z.uuid(),
  message: z.string().trim().min(2, "Écrivez votre message.").max(4000, "4 000 caractères au maximum."),
});

/**
 * Premier message à l'annonceur : ouvre (ou reprend) la conversation à propos
 * de cette annonce, puis mène à la messagerie.
 */
export async function contactSellerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!isFeatureEnabled("messaging")) return { status: "error", message: closedFeatureMessage("messaging") };
  const back = safeRedirectPath(formData.get("retour"), href("search"));
  const parsed = messageSchema.safeParse({ annonce: formData.get("annonce"), message: formData.get("message") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Le message n’est pas valide.",
      fieldErrors: { message: parsed.error.issues[0]?.message ?? "" },
      values: formValues(formData),
    };
  }

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Messagerie momentanément indisponible." };
  // Charte de confiance : acceptée une fois par version, avant le premier message.
  if (!(await hasAcceptedCharter(user.id, "visiteur"))) {
    if (formData.get("charte") !== "1") return { status: "error", message: "Acceptez la charte de confiance pour écrire à l’annonceur.", values: formValues(formData) };
    await recordCharterAcceptance(user.id, "visiteur");
  }

  const { data, error } = await supabase.rpc("start_listing_conversation", { p_listing: parsed.data.annonce, p_body: parsed.data.message });
  if (error) {
    if (READABLE.has(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Conversation non ouverte", { module: "messagerie", code: error.code });
    return { status: "error", message: "Le message n’a pas pu être envoyé. Réessayez.", values: formValues(formData) };
  }
  redirect(href("messageThread", { params: { id: String(data) } }));
}
