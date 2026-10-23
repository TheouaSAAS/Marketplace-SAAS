"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { parseSearchParams, toQueryString } from "../domain/params";
import { SAVED_SEARCH_VERSION } from "./saved";

const log = logger.child({ module: "recherche" });

const nameSchema = z
  .string()
  .trim()
  .min(2, "Donnez un nom d’au moins 2 caractères.")
  .max(80, "80 caractères au maximum.");

/**
 * Enregistre une recherche dans le compte. L'adresse est relue et réécrite
 * par le serveur (aucune valeur non prévue n'est stockée). Sans compte, la
 * personne passe par la connexion puis revient à sa recherche.
 */
export async function saveSearchAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const query = toQueryString(parseSearchParams(Object.fromEntries(new URLSearchParams(String(formData.get("recherche") ?? "")))));
  const searchPath = query ? `${href("search")}?${query}` : href("search");
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: searchPath } }));

  const name = nameSchema.safeParse(formData.get("nom"));
  if (!name.success) return { status: "error", message: "Le nom n’est pas valide.", fieldErrors: { nom: name.error.issues[0]?.message ?? "" }, values: formValues(formData) };
  if (!query) return { status: "error", message: "Précisez d’abord un mot-clé ou un filtre." };

  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Enregistrement momentanément indisponible." };
  const { error } = await supabase
    .from("saved_searches")
    .insert({ user_id: user.id, name: name.data, query: { search: query, version: SAVED_SEARCH_VERSION } });
  if (error) {
    if (error.code === "23514") return { status: "error", message: error.message };
    log.error("Enregistrement de la recherche impossible", { code: error.code });
    return { status: "error", message: "La recherche n’a pas pu être enregistrée. Réessayez." };
  }
  return { status: "success", message: "Recherche enregistrée. Retrouvez-la dans votre tableau de bord (Favoris et échanges)." };
}

export async function deleteSavedSearchAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const user = await getSessionUser();
  const supabase = await createSessionSupabaseClient();
  if (!id.success || !user || !supabase) return { status: "error", message: "Suppression impossible." };
  const { error } = await supabase.from("saved_searches").delete().eq("id", id.data).eq("user_id", user.id);
  if (error) {
    log.error("Suppression de la recherche impossible", { code: error.code });
    return { status: "error", message: "La suppression a échoué. Réessayez." };
  }
  return { status: "success", message: "Recherche supprimée." };
}
