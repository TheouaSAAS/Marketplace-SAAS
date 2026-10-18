import Form from "next/form";
import { Search } from "lucide-react";
import { href } from "@/config/routes";
import { MAX_QUERY_LENGTH, type SearchType } from "../domain/params";

/**
 * Champ principal de la page de recherche (GET, sans JavaScript). Une nouvelle
 * saisie repart de zéro, en restant sur le type de résultats affiché.
 */
export function SearchBox({ query, type }: { query: string; type: SearchType | null }) {
  return (
    <Form action={href("search")} role="search" className="flex w-full max-w-3xl gap-2">
      <label htmlFor="recherche-principale" className="sr-only">
        Que recherchez-vous ?
      </label>
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
        <input
          id="recherche-principale"
          name="q"
          type="search"
          enterKeyHint="search"
          defaultValue={query}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Ex. studio à louer près de moi, électricien, activité ce week-end"
          className="h-12 w-full rounded-pill border border-border-strong bg-surface pl-10 pr-4 text-base text-ink placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
      </div>
      {type && <input type="hidden" name="type" value={type} />}
      <button type="submit" className="inline-flex h-12 shrink-0 items-center rounded-pill bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
        Rechercher
      </button>
    </Form>
  );
}
