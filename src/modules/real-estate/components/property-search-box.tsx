import Form from "next/form";
import { Search } from "lucide-react";
import { href } from "@/config/routes";
import type { RealEstateMode } from "../domain/modes";

/** « Je cherche un logement… » : phrase libre, interprétée en filtres par la page. */
export function PropertySearchBox({ mode, query }: { mode: RealEstateMode; query: string }) {
  return (
    <Form action={href("realEstateMode", { params: { mode } })} role="search" className="flex w-full max-w-3xl gap-2">
      <label htmlFor="recherche-immobilier" className="sr-only">
        Décrivez le bien recherché
      </label>
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
        <input
          id="recherche-immobilier"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={120}
          placeholder="Ex. studio meublé 2 pièces à Bardot moins de 100 000 F"
          className="h-12 w-full rounded-pill border border-border-strong bg-surface pl-10 pr-4 text-base placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
      </div>
      <button type="submit" className="inline-flex h-12 shrink-0 items-center rounded-pill bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
        Rechercher
      </button>
    </Form>
  );
}
