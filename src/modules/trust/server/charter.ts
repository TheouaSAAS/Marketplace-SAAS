import "server-only";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { CHARTER_VERSION } from "../domain/charter";

export type CharterRole = "annonceur" | "visiteur";

/** La personne connectée a-t-elle accepté la version en vigueur de la charte pour ce rôle ? */
export async function hasAcceptedCharter(userId: string, role: CharterRole): Promise<boolean> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return false;
  const { count } = await supabase
    .from("charter_acceptances")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", role)
    .eq("version", CHARTER_VERSION);
  return (count ?? 0) > 0;
}

/** Enregistre l'acceptation datée (une ligne par personne, rôle et version). */
export async function recordCharterAcceptance(userId: string, role: CharterRole): Promise<boolean> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("charter_acceptances")
    .upsert({ user_id: userId, role, version: CHARTER_VERSION }, { onConflict: "user_id,role,version", ignoreDuplicates: true });
  return !error;
}
