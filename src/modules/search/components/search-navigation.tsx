import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";
import { forType, SEARCH_TYPE_KEYS, SEARCH_TYPES, searchHref, withChanges, type ActiveFilter, type SearchParams, type SearchType } from "../domain/params";

const SEARCH = href("search");

/**
 * Onglets par type de contenu. Ce sont des liens (l'onglet fait partie de
 * l'adresse). Le nombre d'un onglet est celui qu'on obtiendra en l'ouvrant :
 * les filtres propres à un type ne suivent pas le changement d'onglet.
 */
export function SearchTabs({
  params,
  counts,
  activeTotal,
}: {
  params: SearchParams;
  counts: Record<SearchType, number> | null;
  activeTotal: number | null;
}) {
  const tabs: { type: SearchType | null; label: string; count: number | null }[] = [
    { type: null, label: "Aperçu", count: null },
    ...SEARCH_TYPE_KEYS.map((type) => ({
      type,
      label: SEARCH_TYPES[type].label,
      count: type === params.type ? activeTotal : (counts?.[type] ?? null),
    })),
  ];
  return (
    // `relative` : les textes pour lecteurs d'écran (positionnés en absolu) restent dans la zone défilante.
    <nav aria-label="Types de résultats" className="relative -mx-4 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const current = tab.type === params.type;
          return (
            <li key={tab.type ?? "apercu"} className="shrink-0">
              <Link
                href={searchHref(SEARCH, forType(params, tab.type))}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors",
                  current ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className={cn("rounded-pill px-2 text-xs", current ? "bg-brand-50 text-brand-700" : "bg-sand-100")}>
                    <span className="sr-only">(</span>
                    {tab.count}
                    <span className="sr-only"> résultats)</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Filtres actifs, chacun retirable par un lien (fonctionne sans JavaScript). */
export function ActiveFilters({ filters, clearAll }: { filters: ActiveFilter[]; clearAll: SearchParams }) {
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="sr-only">Filtres actifs :</p>
      {filters.map((filter) => (
        <Link
          key={filter.key}
          href={searchHref(SEARCH, filter.without)}
          className="inline-flex h-9 items-center gap-1 rounded-pill bg-brand-50 pl-3 pr-2 text-sm font-medium text-brand-800 hover:bg-brand-100"
          aria-label={`Retirer le filtre « ${filter.label} »`}
        >
          {filter.label}
          <X aria-hidden className="h-4 w-4" />
        </Link>
      ))}
      {filters.length > 1 && (
        <Link href={searchHref(SEARCH, clearAll)} className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">
          Tout effacer
        </Link>
      )}
    </div>
  );
}

export function Pagination({ params, total, pageSize }: { params: SearchParams; total: number; pageSize: number }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const page = Math.min(params.page, pages);
  const link = (target: number) => searchHref(SEARCH, withChanges(params, { page: target }));
  const linkClass = "inline-flex min-h-11 items-center gap-1 rounded-control px-3 text-sm font-semibold hover:bg-sand-100";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 border-t border-border pt-4">
      {page > 1 ? (
        <Link href={link(page - 1)} className={linkClass} rel="prev">
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Précédente
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-muted" aria-current="page">
        Page {page} sur {pages}
      </p>
      {page < pages ? (
        <Link href={link(page + 1)} className={linkClass} rel="next">
          Suivante
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
