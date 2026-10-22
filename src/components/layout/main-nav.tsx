"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Compass } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_SECTIONS, NEWCOMER_LINK, type NavSection } from "@/config/navigation";
import { hasPage, href, ROUTES } from "@/config/routes";
import { Popover } from "@/components/ui/popover";
import { NavItemLink } from "./nav-item-link";

function isSectionActive(section: NavSection, pathname: string | null): boolean {
  if (pathname === null) return false;
  return [section.route, ...section.links.map((link) => link.route)].some((route) => {
    const path = ROUTES[route].path;
    return path !== "/" && (pathname === path || pathname.startsWith(`${path}/`));
  });
}

/** Lit l'adresse courante : à placer sous <Suspense> (adresses dynamiques inconnues au prérendu). */
export function MainNav({ className }: { className?: string }) {
  return <MainNavView className={className} pathname={usePathname()} />;
}

/**
 * Navigation principale (ordinateur) : une barre sous l'en-tête, avec un menu
 * déroulant par rubrique et l'accès signature « Nouveau à San Pedro ? ».
 * `pathname` null : aucune rubrique active (repli pendant le chargement).
 */
export function MainNavView({ className, pathname }: { className?: string; pathname: string | null }) {
  const newcomerActive = pathname?.startsWith(ROUTES.newcomer.path) ?? false;

  return (
    <nav aria-label="Navigation principale" className={cn("items-center gap-1", className)}>
      {NAV_SECTIONS.map((section) => (
        <Popover key={section.key} label={section.label} active={isSectionActive(section, pathname)} panelClassName="w-[36rem]">
          {(close) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4 border-b border-border px-3 pb-2 pt-1">
                <p className="text-sm text-ink-muted">{section.tagline}</p>
                {hasPage(section.route) && (
                  <Link
                    href={href(section.route)}
                    onClick={close}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Tout voir <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                )}
              </div>
              <ul className="grid grid-cols-2 gap-0.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <NavItemLink
                      link={link}
                      onNavigate={close}
                      className="flex min-h-11 items-center rounded-control px-3 py-2 text-sm font-medium hover:bg-sand-100"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Popover>
      ))}
      <Link
        href={href(NEWCOMER_LINK.route)}
        aria-current={newcomerActive ? "page" : undefined}
        className={cn(
          "ml-1 inline-flex h-11 items-center gap-1.5 rounded-pill px-4 text-sm font-bold transition-colors",
          newcomerActive ? "bg-accent-600 text-white" : "bg-accent-50 text-accent-700 hover:bg-accent-100",
        )}
      >
        <Compass aria-hidden className="h-4 w-4" />
        {NEWCOMER_LINK.label}
      </Link>
    </nav>
  );
}
