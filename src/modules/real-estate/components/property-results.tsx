import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { href } from "@/config/routes";
import { EmptyState } from "@/components/ui/feedback";
import { EMPTY_FILTERS, realEstateQuery, withFilters, type RealEstateFilters } from "../domain/filters";
import type { RealEstateMode } from "../domain/modes";
import type { RealEstateCardData } from "../server/queries";
import { PropertyCard } from "./property-card";

function pageHref(mode: RealEstateMode, filters: RealEstateFilters): string {
  const query = realEstateQuery(filters);
  const base = href("realEstateMode", { params: { mode } });
  return query ? `${base}?${query}` : base;
}

export function PropertyResults({
  mode,
  filters,
  total,
  items,
  pageSize,
  now,
}: {
  mode: RealEstateMode;
  filters: RealEstateFilters;
  total: number;
  items: RealEstateCardData[];
  pageSize: number;
  now: Date;
}) {
  if (total === 0) {
    return (
      <EmptyState
        icon={<SearchX aria-hidden className="h-6 w-6" />}
        title="Aucun bien ne correspond à ces critères"
        description="La plateforme démarre : peu d’annonces sont encore publiées. Élargissez votre budget, retirez un filtre ou revenez plus tard."
        action={
          <Link href={pageHref(mode, { ...EMPTY_FILTERS, q: filters.q })} className="font-semibold text-brand-700 underline">
            Retirer tous les filtres
          </Link>
        }
      />
    );
  }
  const pages = Math.ceil(total / pageSize);
  const page = Math.min(filters.page, pages);
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Biens">
        {items.map((property) => (
          <li key={property.id} className="flex [&>article]:flex-1">
            <PropertyCard property={property} now={now} />
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {page > 1 ? (
            <Link href={pageHref(mode, withFilters(filters, { page: page - 1 }))} rel="prev" className="inline-flex min-h-11 items-center gap-1 font-semibold">
              <ChevronLeft aria-hidden className="h-4 w-4" /> Précédente
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-ink-muted">
            Page {page} sur {pages}
          </p>
          {page < pages ? (
            <Link href={pageHref(mode, withFilters(filters, { page: page + 1 }))} rel="next" className="inline-flex min-h-11 items-center gap-1 font-semibold">
              Suivante <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

export { pageHref as realEstatePageHref };
