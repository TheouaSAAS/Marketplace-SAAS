"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import type { FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getSessionUser } from "@/server/auth";

/** Ajoute ou retire une annonce des favoris (liste privée de la personne connectée). */
export async function toggleFavoriteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("favorites"));
  const listingId = z.uuid().safeParse(formData.get("annonce"));
  if (!listingId.success) return { status: "error", message: "Annonce introuvable." };

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Favoris momentanément indisponibles." };

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId.data)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("favorites").delete().eq("id", existing.id)
    : await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId.data });
  if (error) {
    logger.error("Favori non enregistré", { module: "annonce", code: error.code });
    return { status: "error", message: "Le favori n’a pas pu être enregistré. Réessayez." };
  }
  revalidatePath(back);
  return { status: "success", message: existing ? "Retirée de vos favoris." : "Ajoutée à vos favoris." };
}
