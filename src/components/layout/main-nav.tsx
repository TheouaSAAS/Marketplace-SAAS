"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_FAMILIES, type NavFamily } from "@/config/navigation";
import { href, isLive, ROUTES } from "@/config/routes";
import { Popover } from "@/components/ui/popover";
import { NavItemLink } from "./nav-item-link";

function isFamilyActive(family: NavFamily, pathname: string): boolean {
  return [family.route, ...family.links.map((link) => link.route)].some((route) => {
    const path = ROUTES[route].path;
    return path !== "/" && pathname.startsWith(path);
  });
}

/** Navigation principale (ordinateur) : un menu déroulant par famille. */
export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className={cn("items-center gap-1", className)}>
      {NAV_FAMILIES.map((family) => (
        <Popover key={family.key} label={family.label} active={isFamilyActive(family, pathname)} panelClassName="w-[38rem]">
          {(close) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4 border-b border-border px-3 pb-2 pt-1">
                <p className="text-sm text-ink-muted">{family.tagline}</p>
                {isLive(family.route) && (
                  <Link
                    href={href(family.route)}
                    onClick={close}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Tout voir <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                )}
              </div>
              <ul className="grid grid-cols-2 gap-0.5">
                {family.links.map((link) => (
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
    </nav>
  );
}
