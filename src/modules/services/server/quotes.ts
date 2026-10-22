import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { single } from "@/modules/shared/server/schemas";

const quoteSchema = z.object({
  id: z.uuid(),
  created_at: z.string(),
  status: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()),
  sender_id: z.uuid().nullable(),
  sender_name: z.string(),
  sender_phone: z.string().nullable(),
  sender_email: z.string().nullable(),
  business: single(z.object({ name: z.string(), slug: z.string() }).nullable()),
});

export type QuoteRequest = z.infer<typeof quoteSchema>;

/** Demandes de devis envoyées et reçues par la personne connectée (règles d'accès de la base). */
export async function listMyQuotes(userId: string): Promise<{ sent: QuoteRequest[]; received: QuoteRequest[] }> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { sent: [], received: [] };
  const { data, error } = await supabase
    .from("contact_requests")
    .select("id, created_at, status, message, details, sender_id, sender_name, sender_phone, sender_email, business:business_profiles(name, slug)")
    .eq("kind", "devis")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Lecture des demandes de devis impossible : ${error.message}`);
  const all = z.array(quoteSchema).parse(data);
  return { sent: all.filter((quote) => quote.sender_id === userId), received: all.filter((quote) => quote.sender_id !== userId) };
}
