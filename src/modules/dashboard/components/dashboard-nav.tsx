"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";

const ITEMS = [
  { key: "dashboard", label: "Vue d’ensemble" },
  { key: "myListings", label: "Mes annonces" },
  { key: "dashboardActivity", label: "Favoris et échanges" },
  { key: "dashboardNotifications", label: "Notifications" },
  { key: "dashboardPrivacy", label: "Confidentialité" },
] as const;

/** Navigation du tableau de bord : défilement horizontal sur mobile, colonne sur grand écran. */
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Tableau de bord" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 lg:flex-col">
        {ITEMS.map((item) => {
          const target = href(item.key);
          const active = pathname === target;
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={target}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-semibold whitespace-nowrap lg:w-full lg:rounded-control",
                  active ? "bg-brand-600 text-white" : "border border-border bg-surface hover:bg-sand-100",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
