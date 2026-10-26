import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";

export const ACCESS_EVENT_LABELS = {
  connexion: "Connexion (second facteur vérifié)",
  echec: "Échec de connexion",
  refus: "Refus : compte sans accès",
  second_facteur_echec: "Code du second facteur refusé",
  second_facteur_active: "Second facteur configuré",
  deconnexion: "Déconnexion",
} as const;

const entrySchema = z.object({
  id: z.uuid(),
  event: z.enum(Object.keys(ACCESS_EVENT_LABELS) as [keyof typeof ACCESS_EVENT_LABELS, ...(keyof typeof ACCESS_EVENT_LABELS)[]]),
  created_at: z.string(),
  ip_fingerprint: z.string().nullable(),
  profile: z.object({ display_name: z.string().nullable() }).nullable(),
});

export type AccessEntry = z.infer<typeof entrySchema>;

/** Derniers accès à l'administration (lecture réservée aux administrateurs par la base). */
export async function listAdminAccess(limit = 50): Promise<AccessEntry[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("admin_access_log")
    .select("id, event, created_at, ip_fingerprint, profile:profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Journal des accès indisponible : ${error.message}`);
  return z.array(entrySchema).parse(data);
}
