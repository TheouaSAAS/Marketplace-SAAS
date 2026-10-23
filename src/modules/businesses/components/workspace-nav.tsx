"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { href, type RouteKey } from "@/config/routes";
import { cn } from "@/lib/cn";

const ITEMS: { key: RouteKey; label: string }[] = [
  { key: "proWorkspace", label: "Aperçu" },
  { key: "proListings", label: "Annonces et offres" },
  { key: "proInbox", label: "Demandes" },
  { key: "proStats", label: "Statistiques" },
  { key: "proModeration", label: "Vérification" },
  { key: "proOffers", label: "Offres" },
];

/** Navigation de l'espace d'une page : onglets défilants sur mobile, colonne sur grand écran. */
export function WorkspaceNav() {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  return (
    <nav aria-label="Espace professionnel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 lg:flex-col">
        {ITEMS.map((item) => {
          const target = href(item.key, { params: { id } });
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
        <li className="shrink-0">
          <Link href={href("proPageEditor", { params: { id } })} className="inline-flex min-h-11 items-center rounded-pill border border-border bg-surface px-4 text-sm font-semibold whitespace-nowrap hover:bg-sand-100 lg:w-full lg:rounded-control">
            Modifier la page et l’équipe
          </Link>
        </li>
      </ul>
    </nav>
  );
}
