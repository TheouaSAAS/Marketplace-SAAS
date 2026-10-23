"use server";

import { logger } from "@/lib/logger";
import { getSessionUser } from "@/server/auth";
import { QUESTION_MIN, sanitizeQuestion } from "../domain/rag";
import type { AskState } from "../domain/ask-state";
import { askSanPedro } from "./assistant";

/** Question posée à « Demandez à San Pedro » (panneau global ou plan nouvel arrivant). */
export async function askAction(_previous: AskState, formData: FormData): Promise<AskState> {
  const raw = String(formData.get("question") ?? "");
  const question = sanitizeQuestion(raw);
  if (question.length < QUESTION_MIN) return { status: "error", question: raw, message: "Posez votre question en quelques mots." };
  const context = sanitizeQuestion(String(formData.get("contexte") ?? "")).slice(0, 200) || undefined;
  try {
    const user = await getSessionUser();
    const result = await askSanPedro(question, { userId: user?.id ?? null, context });
    return { status: "done", question, result };
  } catch (error) {
    logger.error("Assistant indisponible", { module: "assistant", error });
    return { status: "error", question, message: "L’assistant est momentanément indisponible. Réessayez dans quelques instants." };
  }
}
