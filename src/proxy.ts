import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { internalTokenMatches } from "@/lib/internal-token";
import { hasSupabaseSessionCookie, refreshSupabaseSession } from "@/lib/supabase/proxy-session";

/**
 * Proxy (ex-middleware) : contrôles exécutés AVANT le rendu.
 *
 * 0. Maintenance : toutes les pages publiques servent /maintenance (503).
 * 1. Pages internes (/interne/*) : sans jeton valide, réécriture vers une
 *    adresse inexistante pour obtenir une vraie 404.
 * 2. Espaces protégés : sans cookie de session, redirection vers la connexion.
 *    Contrôle « optimiste » : chaque page et action revérifie la session côté
 *    serveur ; la base applique ses propres règles d'accès.
 * 3. Session Supabase : rafraîchie uniquement si un cookie de session existe
 *    (aucun coût pour les visiteurs anonymes).
 */

const PROTECTED_PREFIXES = ["/profil", "/favoris", "/messages", "/devis", "/espace-pro", "/admin"];

/** Chemins toujours servis, même en maintenance (supervision et page elle-même). */
const MAINTENANCE_EXEMPT = ["/maintenance", "/interne", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 0. Mode maintenance (FEATURE_MAINTENANCE=on) : 503 pour les moteurs et les sondes.
  if (process.env.FEATURE_MAINTENANCE === "on" && !MAINTENANCE_EXEMPT.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.rewrite(new URL("/maintenance", request.url), {
      status: 503,
      headers: { "Retry-After": "600", "Cache-Control": "no-store" },
    });
  }

  if (pathname.startsWith("/interne")) {
    const token = request.nextUrl.searchParams.get("token");
    if (!internalTokenMatches(token, process.env.INTERNAL_STATUS_TOKEN || undefined)) {
      return NextResponse.rewrite(new URL("/__introuvable", request.url));
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const hasSession = hasSupabaseSessionCookie(request);
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtected && !hasSession) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("suivant", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (hasSession && isSupabaseConfigured()) {
    const response = await refreshSupabaseSession(request);
    if (isProtected) response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  // Toutes les pages, sauf fichiers statiques et métadonnées.
  matcher: ["/((?!_next/static|_next/image|icon.svg|robots.txt|sitemap.xml|api/health|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml|js)$).*)"],
};
