import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { href } from "@/config/routes";
import { effectiveRole, isBackOffice, type UserRole } from "@/domain/roles";
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
  /** Niveau d'authentification de la session : « aal2 » après le second facteur. */
  assurance: string | null;
}

export interface Account extends SessionUser {
  displayName: string | null;
  avatarUrl: string | null;
  /** Rôle EFFECTIF : celui qui s'applique maintenant (droits du back-office seulement après le second facteur). */
  role: UserRole;
  /** Rôle attribué au compte (affichage, parcours de connexion de l'administration). */
  storedRole: UserRole;
  /** Rôle du back-office en attente du second facteur. */
  secondFactorPending: boolean;
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
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    assurance: typeof data.claims.aal === "string" ? data.claims.aal : null,
  };
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
  const secondFactorRequired = isBackOffice(profile.role) ? await isSecondFactorRequired() : false;
  const role = effectiveRole(profile.role, user.assurance, secondFactorRequired);
  return {
    ...user,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    role,
    storedRole: profile.role,
    secondFactorPending: role !== profile.role,
    isSuspended: profile.is_suspended,
    accountIntent: preferences?.account_intent === "professionnel" ? "professionnel" : "particulier",
    emailConfirmed: Boolean(authUser.user?.email_confirmed_at),
  };
});

/**
 * Second facteur exigé pour le back-office (réglage de la plateforme, appliqué
 * aussi par la base). En cas de doute (base injoignable), exigé.
 */
async function isSecondFactorRequired(): Promise<boolean> {
  const supabase = await createSessionSupabaseClient();
  const { data, error } = (await supabase?.rpc("backoffice_mfa_required")) ?? { data: null, error: null };
  return error || typeof data !== "boolean" ? true : data;
}

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

/**
 * Exige un compte ; sinon redirige vers la connexion en mémorisant la page
 * demandée. Pour l'administration : sa propre page de connexion, et le second
 * facteur avant toute page si le rôle du back-office l'attend encore.
 */
export async function requireAccount(nextPath: string): Promise<Account> {
  const backOffice = nextPath === href("admin") || nextPath.startsWith(`${href("admin")}/`);
  const account = await getCurrentAccount();
  if (!account) redirect(href(backOffice ? "adminLogin" : "login", { query: { suivant: nextPath } }));
  if (backOffice && account.secondFactorPending) redirect(href("adminVerify", { query: { suivant: nextPath } }));
  return account;
}
