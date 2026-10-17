import { logger } from "./logger";

/**
 * Erreurs applicatives et format de résultat des actions serveur.
 *
 * - Une erreur ATTENDUE (droits, validation, absence) est une `AppError` :
 *   son message est rédigé pour l'utilisateur, en français.
 * - Une erreur INATTENDUE est journalisée et remplacée par un message générique :
 *   aucun détail technique (SQL, pile) ne part vers le navigateur.
 */

export type ErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "feature_disabled"
  | "unavailable"
  | "internal";

export const HTTP_STATUS: Record<ErrorCode, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  feature_disabled: 503,
  unavailable: 503,
  internal: 500,
};

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  validation: "Certaines informations sont invalides.",
  unauthenticated: "Connectez-vous pour continuer.",
  forbidden: "Vous n’avez pas l’autorisation d’effectuer cette action.",
  not_found: "Ce contenu est introuvable ou n’est plus disponible.",
  conflict: "Ce contenu a été modifié entre-temps. Rechargez la page.",
  rate_limited: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  feature_disabled: "Cette fonctionnalité n’est pas disponible pour le moment.",
  unavailable: "Le service est momentanément indisponible. Réessayez plus tard.",
  internal: "Une erreur inattendue est survenue. Réessayez plus tard.",
};

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;

  constructor(code: ErrorCode, message?: string, options?: { fieldErrors?: FieldErrors; cause?: unknown }) {
    super(message ?? DEFAULT_MESSAGES[code], { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
  }
}

export interface PublicError {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: PublicError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message?: string, fieldErrors?: FieldErrors): { ok: false; error: PublicError } {
  return { ok: false, error: { code, message: message ?? DEFAULT_MESSAGES[code], fieldErrors } };
}

/** Convertit n'importe quelle erreur en erreur publique, en journalisant les inattendues. */
export function toPublicError(error: unknown, context: Record<string, unknown> = {}): PublicError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, fieldErrors: error.fieldErrors };
  }
  logger.error("Erreur inattendue", { ...context, error });
  return { code: "internal", message: DEFAULT_MESSAGES.internal };
}
