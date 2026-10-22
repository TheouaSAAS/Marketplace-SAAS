import Link from "next/link";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";
import type { Category } from "@/server/repositories/categories";

/** Vues spécialisées (référentiel administrable) ; une vue filtre l'annuaire. */
export function ShopViews({ views, current }: { views: Category[]; current: string | null }) {
  const items = [{ slug: null, name: "Tous les commerces" }, ...views.map((view) => ({ slug: view.slug, name: view.name }))];
  return (
    <nav aria-label="Types de commerces">
      <ul className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {items.map((item) => (
          <li key={item.slug ?? "tous"} className="shrink-0">
            <Link
              href={href("shops", { query: { type: item.slug } })}
              aria-current={item.slug === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold",
                item.slug === current ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface hover:border-brand-300",
              )}
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
