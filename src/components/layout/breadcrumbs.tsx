import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { SITE } from "@/config/site";

export interface Crumb {
  label: string;
  /** Absent pour la page courante. */
  href?: string;
}

/**
 * Fil d'Ariane : « Accueil › Rubrique › Page ». Inclut les données structurées
 * BreadcrumbList (schema.org) pour les moteurs de recherche.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const all: Crumb[] = [{ label: "Accueil", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      ...(crumb.href && { item: `${SITE.url}${crumb.href === "/" ? "" : crumb.href}` }),
    })),
  };

  return (
    <nav aria-label="Fil d’Ariane" className={cn("text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-ink-muted">
        {all.map((crumb, index) => {
          const last = index === all.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="truncate rounded hover:text-brand-700 hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="truncate font-medium text-ink">
                  {crumb.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink-subtle" />}
            </li>
          );
        })}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </nav>
  );
}
