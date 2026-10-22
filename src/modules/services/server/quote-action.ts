"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getSessionUser } from "@/server/auth";
import { QUOTE_TIMINGS } from "../domain/quote";

const quoteSchema = z
  .object({
    professionnel: z.uuid(),
    prestation: z.string().trim().min(2, "Précisez la prestation souhaitée.").max(120, "120 caractères au maximum."),
    quand: z.enum(Object.keys(QUOTE_TIMINGS) as [keyof typeof QUOTE_TIMINGS, ...(keyof typeof QUOTE_TIMINGS)[]], { error: "Indiquez le délai souhaité." }),
    quartier: z.string().trim().max(80, "80 caractères au maximum.").optional(),
    message: z.string().trim().min(10, "Décrivez votre besoin en quelques mots (10 caractères au moins).").max(3000, "3 000 caractères au maximum."),
    nom: z.string().trim().min(2, "Indiquez votre nom.").max(80, "80 caractères au maximum."),
    telephone: z.string().trim().max(30, "Numéro trop long.").optional(),
    email: z.email("Adresse e-mail invalide.").optional(),
    accord: z.literal("1", { error: "Votre accord est nécessaire pour transmettre vos coordonnées." }),
  })
  .refine((value) => Boolean(value.telephone || value.email), { message: "Indiquez un téléphone ou un e-mail.", path: ["telephone"] });

/**
 * Demande de devis structurée. Les coordonnées ne sont transmises au
 * professionnel qu'avec l'accord explicite de la personne (case à cocher) ;
 * la base vérifie que le professionnel accepte les devis et limite le débit.
 */
export async function requestQuoteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("services"));
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" && value.trim() !== "" ? value : undefined;
  };
  const parsed = quoteSchema.safeParse({
    professionnel: read("professionnel"),
    prestation: read("prestation"),
    quand: read("quand"),
    quartier: read("quartier"),
    message: read("message"),
    nom: read("nom"),
    telephone: read("telephone"),
    email: read("email"),
    accord: read("accord"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Certaines informations sont à compléter.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  }

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Demandes de devis momentanément indisponibles.", values: formValues(formData) };

  const { prestation, quand, quartier, message, nom, telephone, email, professionnel } = parsed.data;
  const { error } = await supabase.from("contact_requests").insert({
    kind: "devis",
    sender_id: user.id,
    // Remplacé par la base (déclencheur set_contact_request_recipient) : jamais choisi par le client.
    recipient_id: user.id,
    business_id: professionnel,
    sender_name: nom,
    sender_phone: telephone ?? null,
    sender_email: email ?? null,
    message,
    details: { prestation, quand, quartier: quartier ?? null },
    consented_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "CP429" || error.code === "23514" || error.code === "23503") {
      return { status: "error", message: error.message, values: formValues(formData) };
    }
    logger.error("Demande de devis non envoyée", { module: "services", code: error.code });
    return { status: "error", message: "La demande n’a pas pu être envoyée. Réessayez.", values: formValues(formData) };
  }
  return { status: "success", message: "Demande envoyée. Le professionnel vous répondra avec les coordonnées que vous avez indiquées." };
}
