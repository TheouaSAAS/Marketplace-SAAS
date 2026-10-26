import { z } from "zod";

/**
 * Règles des formulaires de compte. La politique de mot de passe est identique
 * à celle configurée dans Supabase (`npm run db:auth-config`) : 10 caractères,
 * au moins une lettre et un chiffre.
 */

/** Versions des documents acceptés à l'inscription (historisées dans `consents`). */
export const TERMS_VERSION = "2026-10";
export const PRIVACY_VERSION = "2026-10";

export const PASSWORD_MIN_LENGTH = 10;

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`au moins ${PASSWORD_MIN_LENGTH} caractères`);
  if (!/[a-zA-Z]/.test(password)) issues.push("au moins une lettre");
  if (!/[0-9]/.test(password)) issues.push("au moins un chiffre");
  if (password.length > 72) issues.push("72 caractères au maximum");
  return issues;
}

const email = z
  .string({ error: "Indiquez votre adresse e-mail." })
  .trim()
  .toLowerCase()
  .min(1, "Indiquez votre adresse e-mail.")
  .max(254, "Adresse e-mail trop longue.")
  .pipe(z.email("Adresse e-mail invalide."));

const password = z.string({ error: "Choisissez un mot de passe." }).superRefine((value, context) => {
  const issues = passwordIssues(value);
  if (issues.length > 0) {
    context.addIssue({ code: "custom", message: `Le mot de passe doit contenir ${issues.join(", ")}.` });
  }
});

/** Case cochée d'un formulaire HTML : « on » si cochée, absente sinon. */
const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

/** Champ facultatif d'un formulaire HTML : chaîne vide = absent. */
const optionalText = (schema: z.ZodType) => z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema.optional());

/**
 * Inscription. Le type de profil n'accorde aucun droit : il oriente le parcours
 * et, pour un professionnel, préremplit sa future page (jamais publiée sans
 * complétude ni modération). Aucun rôle d'administration n'est proposé.
 */
export const signUpSchema = z
  .object({
    displayName: z
      .string({ error: "Indiquez votre nom." })
      .trim()
      .min(2, "Votre nom doit contenir au moins 2 caractères.")
      .max(80, "Votre nom est trop long."),
    email,
    password,
    accountIntent: z.enum(["particulier", "professionnel"], { error: "Choisissez un type de profil." }),
    businessName: optionalText(z.string().trim().min(2, "Le nom de l’activité doit contenir au moins 2 caractères.").max(120, "Nom d’activité trop long.")),
    businessCategory: optionalText(z.uuid("Choisissez le secteur de votre activité.")),
    acceptTerms: checkbox.refine((value) => value, "Vous devez accepter les conditions d’utilisation et la politique de confidentialité."),
    marketingEmail: checkbox,
  })
  .superRefine((data, context) => {
    if (data.accountIntent !== "professionnel") return;
    if (!data.businessName) context.addIssue({ code: "custom", path: ["businessName"], message: "Indiquez le nom de votre activité." });
    if (!data.businessCategory) context.addIssue({ code: "custom", path: ["businessCategory"], message: "Choisissez le secteur de votre activité." });
  });

export const signInSchema = z.object({
  email,
  password: z.string({ error: "Indiquez votre mot de passe." }).min(1, "Indiquez votre mot de passe."),
});

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirmation: z.string() })
  .refine((data) => data.password === data.confirmation, {
    path: ["confirmation"],
    message: "Les deux mots de passe ne correspondent pas.",
  });

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Votre nom doit contenir au moins 2 caractères.").max(80, "Votre nom est trop long."),
});

export const deleteAccountSchema = z.object({
  confirmation: z.literal("SUPPRIMER", { error: "Saisissez SUPPRIMER en majuscules pour confirmer." }),
});

/**
 * N'accepte qu'un chemin interne (« /profil »), jamais une URL externe ni
 * « //domaine » : empêche les redirections ouvertes après connexion.
 */
export function safeRedirectPath(candidate: unknown, fallback = "/profil"): string {
  if (typeof candidate !== "string") return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(candidate) || candidate.length > 512) return fallback;
  return candidate;
}
