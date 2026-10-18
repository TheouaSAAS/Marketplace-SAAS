import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { href } from "@/config/routes";
import type { UserRole } from "@/domain/roles";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";

/*
 * Couche d'accès à l'identité (Data Access Layer). Lit les cookies : appeler
 * depuis un composant placé derrière <Suspense>, une action serveur ou une
 * route. `cache()` évite de relire la session plusieurs fois par requête.
 */

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface Account extends SessionUser {
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isSuspended: boolean;
  accountIntent: "particulier" | "professionnel";
  emailConfirmed: boolean;
}

/** Utilisateur dont le jeton a été VÉRIFIÉ (signature), jamais une session lue telle quelle. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // La vérification du jeton lit l'heure courante : lecture strictement liée
  // à la requête, jamais pré-rendue ni pré-chargée (Cache Components).
  await connection();
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : null };
});

/** Compte complet : identité vérifiée + profil + préférences. */
export const getCurrentAccount = cache(async (): Promise<Account | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return null;

  const [{ data: authUser }, { data: profile, error }, { data: preferences }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, avatar_url, role, is_suspended").eq("id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("account_intent").eq("user_id", user.id).maybeSingle(),
  ]);
  if (error || !profile) {
    if (error) logger.error("Lecture du profil impossible", { module: "comptes", error });
    return null;
  }
  return {
    ...user,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    isSuspended: profile.is_suspended,
    accountIntent: preferences?.account_intent === "professionnel" ? "professionnel" : "particulier",
    emailConfirmed: Boolean(authUser.user?.email_confirmed_at),
  };
});

/** Résumé léger pour l'en-tête (une seule requête) : nom et avatar. */
export const getAccountSummary = cache(async (): Promise<{ name: string; avatarUrl: string | null } | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSessionSupabaseClient();
  const { data } = (await supabase?.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle()) ?? {
    data: null,
  };
  return { name: data?.display_name ?? user.email ?? "Mon compte", avatarUrl: data?.avatar_url ?? null };
});

/** Exige un compte ; sinon redirige vers la connexion en mémorisant la page demandée. */
export async function requireAccount(nextPath: string): Promise<Account> {
  const account = await getCurrentAccount();
  if (!account) redirect(href("login", { query: { suivant: nextPath } }));
  return account;
}
