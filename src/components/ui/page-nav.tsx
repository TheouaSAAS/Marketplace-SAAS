import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const LINK = "inline-flex min-h-11 items-center gap-1 rounded-control px-3 text-sm font-semibold hover:bg-sand-100";

/** Pagination « Précédente / Suivante » d'une liste dont les critères sont dans l'adresse. */
export function PageNav({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (page: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const current = Math.min(page, pages);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 border-t border-border pt-4">
      {current > 1 ? (
        <Link href={hrefFor(current - 1)} className={LINK} rel="prev">
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Précédente
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-ink-muted" aria-current="page">
        Page {current} sur {pages}
      </p>
      {current < pages ? (
        <Link href={hrefFor(current + 1)} className={LINK} rel="next">
          Suivante
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
