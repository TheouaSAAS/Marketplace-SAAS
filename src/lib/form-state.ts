import type { z } from "zod";

/**
 * État d'un formulaire traité par une action serveur (`useActionState`).
 * Les valeurs saisies sont renvoyées pour ne pas les faire retaper — jamais
 * les mots de passe.
 */
export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export const INITIAL_FORM_STATE: FormState = { status: "idle" };

const NEVER_ECHOED = /pass|confirmation|token/i;

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$") && !NEVER_ECHOED.test(key)) values[key] = value;
  }
  return values;
}

/** Première erreur de chaque champ, prête à afficher. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    errors[key] ??= issue.message;
  }
  return errors;
}

export function invalidForm(error: z.ZodError, formData: FormData): FormState {
  return {
    status: "error",
    message: "Certaines informations sont à corriger.",
    fieldErrors: fieldErrorsFrom(error),
    values: formValues(formData),
  };
}
