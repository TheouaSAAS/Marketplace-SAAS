"use server";

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { isBackOffice } from "@/domain/roles";
import { formValues, invalidForm, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { logAdminAccess } from "@/server/admin-access";
import { getCurrentAccount } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";
import { consumeRateLimit } from "@/server/rate-limit";
import { safeRedirectPath, signInSchema } from "../domain/schemas";

/*
 * Accès au back-office : mot de passe, puis second facteur (application
 * d'authentification, TOTP) vérifié par Supabase Auth. Les droits restent
 * appliqués par la base : sans session « aal2 », un rôle du back-office n'y
 * vaut qu'un simple membre. Aucun rôle n'est jamais attribué ici.
 */

const log = logger.child({ module: "administration" });
const UNAVAILABLE: FormState = { status: "error", message: "L’administration est momentanément indisponible. Réessayez plus tard." };
const BAD_CREDENTIALS = "Adresse e-mail ou mot de passe incorrect.";
const NO_ACCESS = "Ce compte n’a pas accès à l’administration. Si vous pensez qu’il devrait l’avoir, adressez-vous à un administrateur de la plateforme.";

/** Destination après connexion : une page de l'administration seulement. */
function adminDestination(candidate: unknown): string {
  const path = safeRedirectPath(candidate, href("admin"));
  return path === href("admin") || path.startsWith(`${href("admin")}/`) ? path : href("admin");
}

async function client() {
  if (!isFeatureEnabled("accounts")) return null;
  return createSessionSupabaseClient();
}

export async function adminSignInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const supabase = await client();
  if (!supabase) return UNAVAILABLE;
  if (!(await consumeRateLimit("adminSignIn", parsed.data.email))) {
    return { status: "error", message: "Trop de tentatives. Patientez un quart d’heure avant de réessayer.", values: formValues(formData) };
  }

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error && isAuthRetryableFetchError(error)) return { ...UNAVAILABLE, values: formValues(formData) };
    await logAdminAccess("echec", { email: parsed.data.email });
    // Même réponse quelle que soit la cause (adresse inconnue, mot de passe faux, adresse non confirmée).
    return { status: "error", message: BAD_CREDENTIALS, values: formValues(formData) };
  }
  // Lecture par le client qui vient d'ouvrir la session (rôle attribué, pas le rôle effectif).
  const { data: profile } = await supabase.from("profiles").select("role, is_suspended").eq("id", data.user.id).maybeSingle();
  if (!profile || !isBackOffice(profile.role) || profile.is_suspended) {
    await logAdminAccess("refus", { userId: data.user.id });
    // Session fermée : la personne n'est pas laissée connectée sur l'écran d'administration.
    await supabase.auth.signOut({ scope: "local" });
    return { status: "error", message: NO_ACCESS };
  }
  const next = adminDestination(formData.get("suivant"));
  const { data: required } = await supabase.rpc("backoffice_mfa_required");
  if (required === false) {
    await logAdminAccess("connexion", { userId: data.user.id });
    redirect(next);
  }
  redirect(href("adminVerify", { query: { suivant: next } }));
}

export interface EnrollState extends FormState {
  factorId?: string;
  qrCode?: string;
  secret?: string;
}

/** Première configuration du second facteur : QR code et clé à saisir dans l'application d'authentification. */
export async function enrollSecondFactorAction(): Promise<EnrollState> {
  const account = await getCurrentAccount();
  const supabase = await client();
  if (!supabase || !account) return UNAVAILABLE;
  if (!isBackOffice(account.storedRole)) return { status: "error", message: NO_ACCESS };
  if (!(await consumeRateLimit("secondFactor", account.id))) return { status: "error", message: "Trop de tentatives. Patientez un quart d’heure." };

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError || !factors) return UNAVAILABLE;
  // Un facteur déjà actif ne se remplace pas avec le seul mot de passe : réinitialisation par un superadministrateur.
  if (factors.totp.some((factor) => factor.status === "verified")) {
    return { status: "error", message: "Un second facteur est déjà configuré pour ce compte. Utilisez-le, ou demandez sa réinitialisation à un superadministrateur." };
  }
  // Une configuration abandonnée (non vérifiée) est remplacée.
  for (const factor of factors.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `${SITE.name} — ${new Date().toISOString().slice(0, 10)}`, issuer: SITE.name });
  if (error || !data) {
    log.error("Second facteur non configuré", { code: error?.code });
    return { status: "error", message: "Le second facteur n’a pas pu être préparé. Réessayez." };
  }
  return { status: "idle", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

const codeSchema = z.object({
  factorId: z.uuid(),
  code: z
    .string({ error: "Saisissez le code à 6 chiffres." })
    .trim()
    .regex(/^\d{6}$/, "Saisissez le code à 6 chiffres affiché par votre application."),
});

/** Vérifie un code du second facteur : la session passe au niveau « aal2 » et les droits du back-office s'appliquent. */
export async function verifySecondFactorAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = codeSchema.safeParse({ factorId: formData.get("factorId"), code: formData.get("code") });
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const account = await getCurrentAccount();
  const supabase = await client();
  if (!supabase || !account) return UNAVAILABLE;
  if (!isBackOffice(account.storedRole)) return { status: "error", message: NO_ACCESS };
  if (!(await consumeRateLimit("secondFactor", account.id))) return { status: "error", message: "Trop de tentatives. Patientez un quart d’heure." };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.all.find((item) => item.id === parsed.data.factorId && item.factor_type === "totp");
  if (!factor) return { status: "error", message: "Second facteur introuvable : recommencez la configuration." };
  const firstSetup = factor.status === "unverified";

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
  if (error) {
    if (isAuthRetryableFetchError(error)) return UNAVAILABLE;
    await logAdminAccess("second_facteur_echec", { userId: account.id });
    return { status: "error", message: "Code incorrect ou expiré. Saisissez le code affiché en ce moment par votre application." };
  }
  if (firstSetup) await logAdminAccess("second_facteur_active", { userId: account.id });
  await logAdminAccess("connexion", { userId: account.id });
  redirect(adminDestination(formData.get("suivant")));
}
