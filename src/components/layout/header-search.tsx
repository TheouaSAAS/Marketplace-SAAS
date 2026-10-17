import Form from "next/form";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { href, isLive } from "@/config/routes";

/**
 * Champ de recherche globale de l'en-tête. Formulaire GET vers /recherche :
 * fonctionne sans JavaScript. Désactivé, avec explication, tant que la page
 * de résultats n'est pas livrée (phase 3).
 */
export function HeaderSearch({ id, className }: { id: string; className?: string }) {
  const live = isLive("search");

  return (
    <Form action={href("search")} role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Rechercher sur Carrefour des Possibles
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
      <input
        id={id}
        name="q"
        type="search"
        enterKeyHint="search"
        disabled={!live}
        placeholder={live ? "Restaurant, logement, emploi…" : "Recherche à venir"}
        className="h-11 w-full rounded-pill border border-border bg-surface-muted pl-9 pr-4 text-base text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:cursor-not-allowed sm:text-sm"
      />
    </Form>
  );
}
