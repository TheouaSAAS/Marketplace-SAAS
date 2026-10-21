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

/** « J'aime » / « Je n'aime plus » : seul le total est public. La base refuse une annonce non publique. */
export async function toggleLikeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("search"));
  const listingId = z.uuid().safeParse(formData.get("annonce"));
  if (!listingId.success) return { status: "error", message: "Annonce introuvable." };

  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };

  const liked = formData.get("aime") === "1";
  const { error } = liked
    ? await supabase.from("listing_likes").delete().eq("listing_id", listingId.data).eq("user_id", user.id)
    : await supabase.from("listing_likes").insert({ listing_id: listingId.data, user_id: user.id });
  if (error && error.code !== "23505") {
    logger.error("« J'aime » non enregistré", { module: "annonce", code: error.code });
    return { status: "error", message: "Action impossible sur cette annonce pour le moment." };
  }
  revalidatePath(back);
  return { status: "success" };
}
