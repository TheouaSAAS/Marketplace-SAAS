import "server-only";
import { NextResponse } from "next/server";
import { HTTP_STATUS, toPublicError } from "./errors";

/**
 * Convention des routes d'API (`src/app/api/**\/route.ts`) :
 *   succès → 2xx `{ "data": … }` ; échec → 4xx/5xx `{ "error": { code, message, fieldErrors? } }`.
 * Les routes d'API servent aux intégrations (webhooks, carte, IA, applications
 * tierces). Les formulaires de l'interface utilisent des Server Actions.
 */
export function apiData<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function apiError(error: unknown, context: Record<string, unknown> = {}): NextResponse {
  const publicError = toPublicError(error, context);
  return NextResponse.json({ error: publicError }, { status: HTTP_STATUS[publicError.code] });
}
