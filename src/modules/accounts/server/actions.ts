"use server";

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { formValues, invalidForm, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";
import { consumeRateLimit } from "@/server/rate-limit";
import {
  deleteAccountSchema,
  emailOnlySchema,
  newPasswordSchema,
  PRIVACY_VERSION,
  profileSchema,
  safeRedirectPath,
  signInSchema,
  signUpSchema,
  TERMS_VERSION,
} from "../domain/schemas";

/*
 * Actions de compte. Principes :
 * - anti-énumération : inscription et mot de passe oublié répondent toujours
 *   la même chose, que l'adresse existe ou non ; la connexion ne précise pas
 *   si c'est l'e-mail ou le mot de passe qui est faux ;
 * - limitation de débit par IP et par adresse visée ;
 * - aucune donnée sensible dans les journaux.
 */

const log = logger.child({ module: "comptes" });

const UNAVAILABLE: FormState = {
  status: "error",
  message: "Les comptes sont momentanément indisponibles. Réessayez plus tard.",
};
const TOO_MANY: FormState = {
  status: "error",
  message: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
};

async function sessionClientOrNull() {
  if (!isFeatureEnabled("accounts")) return null;
  return createSessionSupabaseClient();
}

export async function signUpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const supabase = await sessionClientOrNull();
  if (!supabase) return UNAVAILABLE;
  if (!(await consumeRateLimit("signUp", parsed.data.email))) return { ...TOO_MANY, values: formValues(formData) };

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${SITE.url}${href("authConfirm", { query: { suivant: href("profile") } })}`,
      data: {
        display_name: parsed.data.displayName,
        account_intent: parsed.data.accountIntent,
        consents: { terms: TERMS_VERSION, privacy: PRIVACY_VERSION, marketing_email: parsed.data.marketingEmail },
      },
    },
  });

  if (error) {
    // Panne réseau : ne jamais annoncer un e-mail envoyé alors que rien n'est parti.
    if (isAuthRetryableFetchError(error)) return { ...UNAVAILABLE, values: formValues(formData) };
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "Ce mot de passe est trop faible ou trop courant." }, values: formValues(formData) };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      log.warn("Envoi d'e-mails limité par Supabase", { code: error.code });
      return { status: "error", message: "Le service d’envoi d’e-mails est saturé. Réessayez dans une heure.", values: formValues(formData) };
    }
    // Les autres erreurs (adresse déjà utilisée…) ne sont pas révélées.
    log.warn("Inscription refusée", { code: error.code, status: error.status });
  }
  return {
    status: "success",
    message:
      "Si cette adresse peut être utilisée, vous allez recevoir un e-mail de confirmation. Ouvrez le lien qu’il contient pour activer votre compte.",
  };
}

export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const supabase = await sessionClientOrNull();
  if (!supabase) return UNAVAILABLE;
  if (!(await consumeRateLimit("signIn", parsed.data.email))) return { ...TOO_MANY, values: formValues(formData) };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Panne réseau : ne pas faire croire à un mot de passe erroné.
    if (isAuthRetryableFetchError(error)) return { ...UNAVAILABLE, values: formValues(formData) };
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Votre adresse e-mail n’est pas encore confirmée. Ouvrez le lien reçu par e-mail lors de l’inscription.",
        values: formValues(formData),
      };
    }
    return { status: "error", message: "Adresse e-mail ou mot de passe incorrect.", values: formValues(formData) };
  }
  redirect(safeRedirectPath(formData.get("suivant"), href("profile")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSessionSupabaseClient();
  // « local » : ferme la session de cet appareil seulement, pas celles des autres appareils.
  await supabase?.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function requestPasswordResetAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const supabase = await sessionClientOrNull();
  if (!supabase) return UNAVAILABLE;
  if (!(await consumeRateLimit("passwordReset", parsed.data.email))) return TOO_MANY;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE.url}${href("authConfirm", { query: { suivant: href("resetPassword") } })}`,
  });
  if (error && isAuthRetryableFetchError(error)) return UNAVAILABLE;
  if (error) log.warn("Réinitialisation refusée", { code: error.code, status: error.status });
  return {
    status: "success",
    message: "Si un compte est associé à cette adresse, vous allez recevoir un e-mail pour choisir un nouveau mot de passe.",
  };
}

export async function updatePasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const user = await getSessionUser();
  const supabase = await sessionClientOrNull();
  if (!supabase) return UNAVAILABLE;
  if (!user) {
    return { status: "error", message: "Votre lien a expiré. Demandez un nouvel e-mail de réinitialisation." };
  }
  if (!(await consumeRateLimit("sensitiveAccountAction", user.id))) return TOO_MANY;

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (isAuthRetryableFetchError(error)) return UNAVAILABLE;
    if (error.code === "same_password") return { status: "error", fieldErrors: { password: "Choisissez un mot de passe différent de l’actuel." } };
    if (error.code === "weak_password") return { status: "error", fieldErrors: { password: "Ce mot de passe est trop faible ou trop courant." } };
    if (error.code === "reauthentication_needed") {
      return { status: "error", message: "Pour votre sécurité, déconnectez-vous puis reconnectez-vous avant de changer de mot de passe." };
    }
    log.error("Changement de mot de passe impossible", { code: error.code });
    return { status: "error", message: "Le mot de passe n’a pas pu être changé. Réessayez." };
  }
  log.info("Mot de passe changé", { userId: user.id });
  return { status: "success", message: "Votre mot de passe a été changé." };
}

export async function updateProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const user = await getSessionUser();
  const supabase = await sessionClientOrNull();
  if (!supabase || !user) return UNAVAILABLE;

  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", user.id);
  if (error) {
    log.error("Mise à jour du profil impossible", { code: error.code });
    return { status: "error", message: "Votre profil n’a pas pu être enregistré." };
  }
  return { status: "success", message: "Profil enregistré.", values: formValues(formData) };
}

export async function updateMarketingConsentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  const supabase = await sessionClientOrNull();
  if (!supabase || !user) return UNAVAILABLE;
  const granted = formData.get("marketingEmail") === "on";
  const { error } = await supabase
    .from("consents")
    .insert({ user_id: user.id, kind: "marketing_email", granted, document_version: PRIVACY_VERSION });
  if (error) return { status: "error", message: "Votre choix n’a pas pu être enregistré." };
  return { status: "success", message: granted ? "Vous recevrez nos actualités par e-mail." : "Vous ne recevrez plus nos actualités par e-mail." };
}

export async function changeAccountTypeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  const supabase = await sessionClientOrNull();
  if (!supabase || !user) return UNAVAILABLE;
  const target = formData.get("cible");
  const { error } = await supabase.rpc(target === "professionnel" ? "become_professional" : "become_individual");
  if (error) {
    // Messages rédigés en base (règles métier) : sûrs à afficher.
    const known = ["Confirmez d'abord", "Transférez d'abord", "n'est pas un compte"];
    return {
      status: "error",
      message: known.some((fragment) => error.message.includes(fragment)) ? error.message.replace(/''/g, "’") : "Le changement n’a pas pu être effectué.",
    };
  }
  return {
    status: "success",
    message:
      target === "professionnel"
        ? "Votre compte est maintenant professionnel. Votre page publique sera visible après avoir complété votre profil et passé la modération."
        : "Votre compte est maintenant un compte particulier.",
  };
}

export async function deleteAccountAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidForm(parsed.error, formData);
  const user = await getSessionUser();
  const supabase = await sessionClientOrNull();
  const admin = createAdminSupabaseClient();
  if (!supabase || !user || !admin) return UNAVAILABLE;
  if (!(await consumeRateLimit("sensitiveAccountAction", user.id))) return TOO_MANY;

  // Une organisation ne peut pas rester sans propriétaire.
  const { data: owned } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("role", "owner");
  for (const { organization_id } of owned ?? []) {
    const { count } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return {
        status: "error",
        message: "Vous êtes le seul propriétaire d’une organisation. Transférez-en la propriété ou supprimez-la avant de supprimer votre compte.",
      };
    }
  }

  // Fichiers personnels (images, CV, pièces) : supprimés avant le compte.
  for (const bucket of ["media", "private-media"]) {
    const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((file) => `${user.id}/${file.name}`));
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    log.error("Suppression de compte impossible", { code: error.code, status: error.status });
    return { status: "error", message: "La suppression a échoué. Contactez-nous si le problème persiste." };
  }
  log.info("Compte supprimé", { userId: user.id });
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?compte=supprime");
}
