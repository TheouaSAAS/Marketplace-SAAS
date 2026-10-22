"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, House, Plus, Search, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { MOBILE_TABS } from "@/config/navigation";
import { href, ROUTES } from "@/config/routes";

const ICONS: Record<(typeof MOBILE_TABS)[number]["icon"], ReactNode> = {
  home: <House aria-hidden className="h-6 w-6" />,
  search: <Search aria-hidden className="h-6 w-6" />,
  plus: <Plus aria-hidden className="h-6 w-6" />,
  heart: <Heart aria-hidden className="h-6 w-6" />,
  user: <UserRound aria-hidden className="h-6 w-6" />,
};

function isActive(path: string, pathname: string | null): boolean {
  if (pathname === null) return false;
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

/** Lit l'adresse courante : à placer sous <Suspense> (adresses dynamiques inconnues au prérendu). */
export function BottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}

/**
 * Barre de navigation basse (mobile et tablette) : les cinq destinations
 * principales à portée de pouce. Respecte la zone de sécurité des écrans à encoche.
 * `pathname` null : aucun onglet actif (repli pendant le chargement).
 */
export function BottomNavView({ pathname }: { pathname: string | null }) {
  // Les espaces de compte (connexion, profil…) sont tous rattachés à l'onglet « Compte ».
  const accountPaths = [ROUTES.profile.path, ROUTES.login.path, ROUTES.signup.path];

  return (
    <nav
      aria-label="Navigation rapide"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_TABS.map((tab) => {
          const path = ROUTES[tab.route].path;
          const active = tab.route === "profile" ? accountPaths.some((p) => isActive(p, pathname)) : isActive(path, pathname);
          const isPublish = tab.route === "publish";
          return (
            <li key={tab.route}>
              <Link
                href={href(tab.route)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold",
                  active ? "text-brand-700" : "text-ink-muted",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center",
                    isPublish ? "h-9 w-12 rounded-pill bg-accent-600 text-white" : "h-7 w-12 rounded-pill",
                    active && !isPublish && "bg-brand-50",
                  )}
                >
                  {ICONS[tab.icon]}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
