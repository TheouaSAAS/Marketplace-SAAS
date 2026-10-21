"use server";

import { z } from "zod";
import { href } from "@/config/routes";
import { formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { redirect } from "next/navigation";

const sendSchema = z.object({
  conversation: z.uuid(),
  message: z.string().trim().min(1, "Écrivez votre message.").max(4000, "4 000 caractères au maximum."),
});

/**
 * Envoie un message dans une conversation. La base vérifie que l'expéditeur y
 * participe, qu'il n'est pas suspendu, et limite le débit. Le message apparaît
 * chez l'interlocuteur en temps réel.
 */
export async function sendMessageAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = sendSchema.safeParse({ conversation: formData.get("conversation"), message: formData.get("message") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Message invalide.", values: formValues(formData) };
  }
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: href("messages") } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Messagerie momentanément indisponible.", values: formValues(formData) };

  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: parsed.data.conversation, sender_id: user.id, body: parsed.data.message });
  if (error) {
    if (error.code === "CP429") return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Message non envoyé", { module: "messagerie", code: error.code });
    return { status: "error", message: "Le message n’a pas pu être envoyé. Réessayez.", values: formValues(formData) };
  }
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", parsed.data.conversation)
    .eq("user_id", user.id);
  return { status: "success" };
}

/** Marque la conversation comme lue par la personne connectée. */
export async function markConversationReadAction(conversationId: string): Promise<void> {
  if (!z.uuid().safeParse(conversationId).success) return;
  const user = await getSessionUser();
  const supabase = await createSessionSupabaseClient();
  if (!user || !supabase) return;
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}
