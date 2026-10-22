"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import type { FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { PLACES_CACHE_TAG } from "@/modules/places/server/queries";

const reviewSchema = z.object({
  demande: z.uuid(),
  decision: z.enum(["valider", "refuser"]),
  motif: z.string().trim().max(1000, "1 000 caractères au maximum.").optional(),
});

/** Décision de l'équipe locale ; la base vérifie le rôle, exige un motif de refus et notifie le demandeur. */
export async function reviewClaimAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = reviewSchema.safeParse({
    demande: formData.get("demande"),
    decision: formData.get("decision"),
    motif: formData.get("motif") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "Décision invalide." };
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };

  const approve = parsed.data.decision === "valider";
  const { error } = await supabase.rpc("review_place_claim", { p_claim: parsed.data.demande, p_approve: approve, p_note: parsed.data.motif });
  if (error) {
    if (["23514", "42501"].includes(error.code)) return { status: "error", message: error.message };
    logger.error("Décision de revendication non enregistrée", { module: "commerces", code: error.code });
    return { status: "error", message: "La décision n’a pas pu être enregistrée. Réessayez." };
  }
  updateTag(PLACES_CACHE_TAG);
  // La liste se met à jour (demande traitée retirée) ; la décision est confirmée par l'adresse.
  redirect(href("placeClaims", { query: { decision: approve ? "validee" : "refusee" } }));
}
