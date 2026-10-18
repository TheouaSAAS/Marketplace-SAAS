import "server-only";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { answersSchema, type NewcomerAnswers } from "../domain/answers";

/**
 * Parcours enregistré par l'utilisateur connecté (lit la session : à appeler
 * derrière <Suspense>). Renvoie null sans compte, sans parcours, ou si les
 * réponses enregistrées ne sont plus valides.
 */
export async function getSavedNewcomerAnswers(): Promise<{ answers: NewcomerAnswers; updatedAt: string } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from("newcomer_plans").select("answers, updated_at").eq("user_id", user.id).maybeSingle();
  if (!data) return null;
  const parsed = answersSchema.safeParse(data.answers);
  return parsed.success ? { answers: parsed.data, updatedAt: data.updated_at } : null;
}
