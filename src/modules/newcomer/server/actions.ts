"use server";

import { redirect } from "next/navigation";
import { href } from "@/config/routes";
import type { FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { answersFromSearchParams, answersToSearchParams, ANSWERS_VERSION } from "../domain/answers";

const log = logger.child({ module: "nouvel-arrivant" });

/**
 * Enregistre le parcours dans le compte. Les réponses sont revalidées ici :
 * le serveur ne se fie jamais à ce que le navigateur envoie. Sans compte, la
 * personne est envoyée vers la connexion puis ramenée à son plan.
 */
export async function saveNewcomerPlanAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const query = String(formData.get("reponses") ?? "");
  const answers = answersFromSearchParams(Object.fromEntries(new URLSearchParams(query)));
  if (!answers) return { status: "error", message: "Les réponses sont incomplètes. Reprenez le questionnaire." };

  const planPath = `${href("newcomerPlan")}?${answersToSearchParams(answers).toString()}`;
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: planPath } }));

  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Enregistrement momentanément indisponible." };
  const { error } = await supabase
    .from("newcomer_plans")
    .upsert({ user_id: user.id, answers: { ...answers, version: ANSWERS_VERSION }, plan: null }, { onConflict: "user_id" });
  if (error) {
    log.error("Enregistrement du parcours impossible", { code: error.code });
    return { status: "error", message: "Le parcours n’a pas pu être enregistré. Réessayez." };
  }
  return { status: "success", message: "Parcours enregistré dans votre compte. Vous pourrez le reprendre ou le supprimer à tout moment." };
}

/** Supprime définitivement le parcours enregistré (contrôle total de l'utilisateur). */
export async function deleteNewcomerPlanAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  const supabase = await createSessionSupabaseClient();
  if (!user || !supabase) return { status: "error", message: "Connectez-vous pour gérer votre parcours." };
  const { error } = await supabase.from("newcomer_plans").delete().eq("user_id", user.id);
  if (error) {
    log.error("Suppression du parcours impossible", { code: error.code });
    return { status: "error", message: "La suppression a échoué. Réessayez." };
  }
  const back = formData.get("retour");
  if (back === "profil" || back === "tableau-de-bord") return { status: "success", message: "Votre parcours a été supprimé." };
  redirect(href("newcomer", { query: { supprime: "1" } }));
}
