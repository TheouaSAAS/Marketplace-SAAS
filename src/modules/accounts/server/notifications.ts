import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";

const notificationSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  created_at: z.string(),
  read_at: z.string().nullable(),
});

export type AccountNotification = z.infer<typeof notificationSchema>;

/**
 * Dernières notifications de la personne connectée (décisions, reports,
 * annulations, rappels). Le centre de notifications complet viendra au niveau 24.
 */
export async function listRecentNotifications(limit = 5): Promise<AccountNotification[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("notifications").select("id, title, body, link, created_at, read_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Lecture des notifications impossible : ${error.message}`);
  return z.array(notificationSchema).parse(data);
}
