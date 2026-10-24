import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";

/*
 * Lecture de la messagerie du membre connecté. Les règles d'accès de la base
 * limitent tout aux participants de chaque conversation.
 */

const conversationSchema = z.object({
  conversation_id: z.uuid(),
  other_name: z.string(),
  listing_title: z.string().nullable(),
  listing_slug: z.string().nullable(),
  place_name: z.string().nullable(),
  place_slug: z.string().nullable(),
  event_title: z.string().nullable(),
  event_slug: z.string().nullable(),
  last_message: z.string().nullable(),
  last_message_mine: z.boolean().nullable(),
  last_message_at: z.string(),
  unread: z.number(),
});

export type ConversationSummary = z.infer<typeof conversationSchema>;

export async function listMyConversations(): Promise<ConversationSummary[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("my_conversations");
  if (error) throw new Error(`Lecture des conversations impossible : ${error.message}`);
  return z.array(conversationSchema).parse(data);
}

const headerSchema = z.object({
  other_name: z.string(),
  other_id: z.uuid().nullable(),
  listing_id: z.uuid().nullable(),
  listing_title: z.string().nullable(),
  listing_slug: z.string().nullable(),
  listing_active: z.boolean(),
  place_name: z.string().nullable(),
  place_slug: z.string().nullable(),
  event_title: z.string().nullable(),
  event_slug: z.string().nullable(),
});

const messageSchema = z.object({
  id: z.uuid(),
  sender_id: z.uuid(),
  body: z.string(),
  created_at: z.string(),
});

export type ChatMessage = z.infer<typeof messageSchema>;
export type ConversationHeader = z.infer<typeof headerSchema>;

/** En-tête et derniers messages d'une conversation, ou null si la personne n'y participe pas. */
export async function getConversation(conversationId: string): Promise<{ header: ConversationHeader; messages: ChatMessage[] } | null> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data: header, error: headerError } = await supabase.rpc("conversation_header", { p_conversation: conversationId });
  if (headerError) throw new Error(`Lecture de la conversation impossible : ${headerError.message}`);
  const parsedHeader = z.array(headerSchema).parse(header)[0];
  if (!parsedHeader) return null;

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Lecture des messages impossible : ${error.message}`);
  return { header: parsedHeader, messages: z.array(messageSchema).parse(data).reverse() };
}

/** Marque la conversation comme lue (idempotent, appelé à l'ouverture du fil). */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return;
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

/** Ai-je bloqué ce membre ? (mes blocages seulement, règle d'accès en base) */
export async function isBlocked(memberId: string): Promise<boolean> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return false;
  const { count } = await supabase.from("user_blocks").select("blocked_id", { count: "exact", head: true }).eq("blocked_id", memberId);
  return (count ?? 0) > 0;
}
