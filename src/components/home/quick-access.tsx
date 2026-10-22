import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, House, Map, Store, TreePalm, Utensils, Wrench, type LucideIcon } from "lucide-react";
import { categoryHref, type RouteKey } from "@/config/routes";

const ITEMS: { label: string; route: RouteKey; category?: string; icon: LucideIcon }[] = [
  { label: "Logement", route: "realEstate", icon: House },
  { label: "Services", route: "services", icon: Wrench },
  { label: "Commerces", route: "shops", icon: Store },
  { label: "Restaurants", route: "tourism", category: "restaurants-gastronomie", icon: Utensils },
  { label: "Tourisme", route: "tourism", icon: TreePalm },
  { label: "Carte", route: "map", icon: Map },
  { label: "Emploi", route: "jobs", icon: BriefcaseBusiness },
  { label: "Événements", route: "events", icon: CalendarDays },
];

/** Huit accès directs, au pouce sur mobile (grille de 4 colonnes). */
export function QuickAccess() {
  return (
    // relative z-10 : la carte remonte sous la vague du bandeau (positionné) et doit passer au-dessus.
    <nav aria-label="Accès rapides" className="relative z-10 -mt-12 sm:-mt-16">
      <ul className="grid grid-cols-4 gap-2 rounded-card border border-border bg-surface p-3 shadow-raised sm:gap-3 sm:p-4 lg:grid-cols-8">
        {ITEMS.map(({ label, route, category, icon: Icon }) => (
          <li key={label}>
            <Link
              href={categoryHref(route, category)}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-control px-1 text-center text-xs font-semibold text-ink transition-colors hover:bg-brand-50 hover:text-brand-700 sm:text-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-brand-50 text-brand-700">
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
