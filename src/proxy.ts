import { NextResponse, type NextRequest } from "next/server";
import { internalTokenMatches } from "@/lib/internal-token";

/**
 * Proxy (ex-middleware) : contrôles exécutés AVANT le rendu.
 *
 * Pages internes (/interne/*) : sans autorisation, la requête est réécrite vers
 * une adresse inexistante pour obtenir une vraie réponse 404 (le pré-rendu
 * partiel ne permet plus de changer le code HTTP une fois la page commencée).
 *
 * Le rafraîchissement de session Supabase s'ajoutera ici au niveau 3.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/interne")) {
    const token = request.nextUrl.searchParams.get("token");
    if (!internalTokenMatches(token, process.env.INTERNAL_STATUS_TOKEN || undefined)) {
      return NextResponse.rewrite(new URL("/__introuvable", request.url));
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/interne/:path*"],
};
