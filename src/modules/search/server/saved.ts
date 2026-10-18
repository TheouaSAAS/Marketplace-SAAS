import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { parseSearchParams, toQueryString } from "../domain/params";

/** Format stocké dans `saved_searches.query` : l'adresse de la recherche, versionnée. */
export const SAVED_SEARCH_VERSION = 1;
const storedQuerySchema = z.object({ search: z.string().max(2000), version: z.number() });

export interface SavedSearch {
  id: string;
  name: string;
  /** Partie requête de l'adresse, revalidée à la lecture. */
  query: string;
  createdAt: string;
}

/** Recherches enregistrées du compte connecté (les plus récentes d'abord). */
export async function listSavedSearches(): Promise<SavedSearch[]> {
  const user = await getSessionUser();
  const supabase = await createSessionSupabaseClient();
  if (!user || !supabase) return [];
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, name, query, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Lecture des recherches enregistrées impossible : ${error.message}`);
  return data.flatMap((row) => {
    const stored = storedQuerySchema.safeParse(row.query);
    if (!stored.success) return [];
    const query = toQueryString(parseSearchParams(Object.fromEntries(new URLSearchParams(stored.data.search))));
    return [{ id: row.id, name: row.name, query, createdAt: row.created_at }];
  });
}
