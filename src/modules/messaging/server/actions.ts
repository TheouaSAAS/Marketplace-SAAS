"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { href } from "@/config/routes";
import { formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { redirect } from "next/navigation";
import { closedFeatureMessage, isFeatureEnabled } from "@/server/features";

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
  if (!isFeatureEnabled("messaging")) return { status: "error", message: closedFeatureMessage("messaging") };
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
  revalidatePath(href("messageThread", { params: { id: parsed.data.conversation } }));
  return { status: "success" };
}

/**
 * Bloquer un membre : il ne peut plus vous écrire (règle en base). Débloquer
 * rétablit les échanges. Le membre bloqué n'en est pas averti.
 */
export async function setBlockAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ membre: z.uuid(), conversation: z.uuid(), bloquer: z.enum(["1", "0"]) })
    .safeParse({ membre: formData.get("membre"), conversation: formData.get("conversation"), bloquer: formData.get("bloquer") });
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: href("messages") } }));
  const supabase = await createSessionSupabaseClient();
  if (!parsed.success || !supabase || parsed.data.membre === user.id) return { status: "error", message: "Action impossible." };
  const { error } =
    parsed.data.bloquer === "1"
      ? await supabase.from("user_blocks").upsert({ blocker_id: user.id, blocked_id: parsed.data.membre }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true })
      : await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", parsed.data.membre);
  if (error) {
    logger.error("Blocage non enregistré", { module: "messagerie", code: error.code });
    return { status: "error", message: "L’action n’a pas pu être enregistrée. Réessayez." };
  }
  revalidatePath(href("messageThread", { params: { id: parsed.data.conversation } }));
  return { status: "success", message: parsed.data.bloquer === "1" ? "Membre bloqué : il ne peut plus vous écrire." : "Membre débloqué." };
}
