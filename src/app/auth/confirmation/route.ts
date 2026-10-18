import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";

const OTP_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

/**
 * Aboutissement des liens reçus par e-mail (confirmation d'inscription,
 * réinitialisation, changement d'adresse). Deux formats acceptés :
 * - `token_hash` + `type` : modèles d'e-mails personnalisés, valable sur tout appareil ;
 * - `code` : modèles Supabase par défaut (PKCE), valable dans le navigateur d'origine.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("suivant"), href("profile"));
  const failure = NextResponse.redirect(new URL(href("login", { query: { erreur: "lien" } }), origin));

  const supabase = await createSessionSupabaseClient();
  if (!supabase) return failure;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  let error: { code?: string; message: string } | null = null;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    return failure;
  }

  if (error) {
    logger.warn("Lien de confirmation invalide ou expiré", { module: "comptes", code: error.code });
    return failure;
  }
  const destination = new URL(next, origin);
  if (next === href("profile")) destination.searchParams.set("bienvenue", "1");
  return NextResponse.redirect(destination);
}
