import Link from "next/link";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";
import type { Category } from "@/server/repositories/categories";

/** Métiers groupés (référentiel administrable) ; chaque métier filtre l'annuaire. */
export function TradeList({ tree, current }: { tree: { group: Category; trades: Category[] }[]; current: string | null }) {
  const link = (slug: string) => href("services", { query: { metier: slug } });
  return (
    <nav aria-label="Métiers" className="flex flex-col gap-4">
      {tree.map(({ group, trades }) => (
        <div key={group.id} className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">{group.name}</h2>
          <ul className="flex flex-wrap gap-2">
            {[group, ...trades].map((trade) => (
              <li key={trade.id}>
                <Link
                  href={link(trade.slug)}
                  aria-current={trade.slug === current ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold",
                    trade.slug === current ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface hover:border-brand-300",
                  )}
                >
                  {trade.id === group.id ? `Tout « ${group.name} »` : trade.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
