"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getSessionUser } from "@/server/auth";
import { CLAIMANT_ROLES } from "../domain/claims";

async function signedIn(back: string) {
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  return supabase ? { user, supabase } : null;
}

const placeId = (formData: FormData) => z.uuid().safeParse(formData.get("lieu"));

/** Favori : liste privée. Sans compte, la connexion ramène ici. */
export async function togglePlaceFavoriteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("shops"));
  const id = placeId(formData);
  if (!id.success) return { status: "error", message: "Vitrine introuvable." };
  const session = await signedIn(back);
  if (!session) return { status: "error", message: "Favoris momentanément indisponibles." };

  const { error } =
    formData.get("actif") === "1"
      ? await session.supabase.from("favorites").delete().eq("user_id", session.user.id).eq("place_id", id.data)
      : await session.supabase.from("favorites").insert({ user_id: session.user.id, place_id: id.data });
  if (error && error.code !== "23505") {
    logger.error("Favori non enregistré", { module: "commerces", code: error.code });
    return { status: "error", message: "Le favori n’a pas pu être enregistré. Réessayez." };
  }
  revalidatePath(back);
  return { status: "success" };
}

/** « J'aime » : seul le total est public ; la base refuse une vitrine non publique. */
export async function togglePlaceLikeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("shops"));
  const id = placeId(formData);
  if (!id.success) return { status: "error", message: "Vitrine introuvable." };
  const session = await signedIn(back);
  if (!session) return { status: "error", message: "Service momentanément indisponible." };

  const { error } =
    formData.get("actif") === "1"
      ? await session.supabase.from("place_likes").delete().eq("place_id", id.data).eq("user_id", session.user.id)
      : await session.supabase.from("place_likes").insert({ place_id: id.data, user_id: session.user.id });
  if (error && error.code !== "23505") {
    logger.error("« J'aime » non enregistré", { module: "commerces", code: error.code });
    return { status: "error", message: "Action impossible sur cette vitrine pour le moment." };
  }
  revalidatePath(back);
  return { status: "success" };
}

const messageSchema = z.object({
  lieu: z.uuid(),
  message: z.string().trim().min(2, "Écrivez votre message.").max(4000, "4 000 caractères au maximum."),
});

/** Message à l'exploitant d'une vitrine revendiquée (messagerie interne, aucune coordonnée échangée). */
export async function contactPlaceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("shops"));
  const parsed = messageSchema.safeParse({ lieu: formData.get("lieu"), message: formData.get("message") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const session = await signedIn(back);
  if (!session) return { status: "error", message: "Messagerie momentanément indisponible.", values: formValues(formData) };

  const { data, error } = await session.supabase.rpc("start_place_conversation", { p_place: parsed.data.lieu, p_body: parsed.data.message });
  if (error || !data) {
    if (error && ["23514", "CP429", "42501"].includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Message à une vitrine non envoyé", { module: "commerces", code: error?.code });
    return { status: "error", message: "Le message n’a pas pu être envoyé. Réessayez.", values: formValues(formData) };
  }
  redirect(href("messageThread", { params: { id: String(data) } }));
}

const claimSchema = z.object({
  lieu: z.uuid().optional(),
  page: z.uuid().optional(),
  role: z.enum(Object.keys(CLAIMANT_ROLES) as [keyof typeof CLAIMANT_ROLES, ...(keyof typeof CLAIMANT_ROLES)[]], { error: "Indiquez votre lien avec ce commerce." }),
  message: z.string().trim().min(10, "Présentez-vous en quelques mots (10 caractères au moins).").max(2000, "2 000 caractères au maximum."),
  preuve: z.string().trim().min(3, "Indiquez un élément vérifiable.").max(500, "500 caractères au maximum."),
  telephone: z.string().trim().min(6, "Indiquez un numéro où l’équipe peut vous joindre.").max(30, "Numéro trop long."),
});

/** Revendication d'une vitrine : examinée par l'équipe locale, jamais automatique. */
export async function claimPlaceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("shops"));
  const parsed = claimSchema.safeParse({
    lieu: formData.get("lieu") || undefined,
    page: formData.get("page") || undefined,
    role: formData.get("role"),
    message: formData.get("message"),
    preuve: formData.get("preuve"),
    telephone: formData.get("telephone"),
  });
  if (!parsed.success) return { status: "error", message: "Certaines informations sont à compléter.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  if (!parsed.data.lieu && !parsed.data.page) return { status: "error", message: "Rien à revendiquer.", values: formValues(formData) };
  const session = await signedIn(back);
  if (!session) return { status: "error", message: "Revendication momentanément indisponible.", values: formValues(formData) };

  const { error } = await session.supabase.from("place_claims").insert({
    place_id: parsed.data.lieu ?? null,
    business_id: parsed.data.lieu ? null : (parsed.data.page ?? null),
    claimant_id: session.user.id,
    claimant_role: parsed.data.role,
    message: parsed.data.message,
    evidence: parsed.data.preuve,
    phone: parsed.data.telephone,
  });
  if (error) {
    if (error.code === "23505") return { status: "success", message: "Votre demande est déjà en cours d’examen." };
    if (error.code === "23514" || error.code === "CP429") return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Revendication non enregistrée", { module: "commerces", code: error.code });
    return { status: "error", message: "La demande n’a pas pu être envoyée. Réessayez.", values: formValues(formData) };
  }
  revalidatePath(back);
  return { status: "success", message: "Demande envoyée. L’équipe locale vérifie votre lien avec cet établissement, puis vous notifie sa décision." };
}
