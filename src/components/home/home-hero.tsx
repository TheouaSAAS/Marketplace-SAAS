import Form from "next/form";
import { Compass, Plus, Search } from "lucide-react";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { LAUNCH_CITY } from "@/domain/city";
import { ButtonLink } from "@/components/ui/button";

const SUGGESTIONS = ["Studio à louer", "Restaurant", "Électricien", "Que faire ce week-end"];

/**
 * Bandeau d'accueil : accroche de la ville pilote, recherche en langage courant
 * (formulaire GET, fonctionne sans JavaScript), accès signature et publication.
 */
export function HomeHero() {
  return (
    <section aria-labelledby="accroche" className="relative overflow-hidden bg-brand-900 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-500)_0%,transparent_55%),radial-gradient(ellipse_at_bottom_left,var(--color-accent-700)_0%,transparent_45%)] opacity-60"
      />
      {/* Ligne de côte stylisée : évoque le littoral sans représenter un lieu réel. */}
      <svg aria-hidden="true" viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-10 w-full text-surface-muted sm:h-16">
        <path fill="currentColor" d="M0 48c120 18 240 26 360 18s240-34 360-30 240 34 360 38 240-14 360-26v32H0z" />
      </svg>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-20 pt-8 sm:gap-6 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
        <p className="text-sm font-semibold text-brand-100">
          {SITE.name} — « {SITE.slogan} »
        </p>
        <h1 id="accroche" className="max-w-3xl text-4xl font-extrabold leading-[1.1] sm:text-display">
          Tout {LAUNCH_CITY.name}, au même endroit.
        </h1>
        <p className="max-w-2xl text-lg text-brand-50">{SITE.tagline}</p>

        <Form action={href("search")} role="search" className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
          <label htmlFor="recherche-accueil" className="sr-only">
            Que recherchez-vous à {LAUNCH_CITY.name} ?
          </label>
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
            <input
              id="recherche-accueil"
              name="q"
              type="search"
              enterKeyHint="search"
              placeholder={`Que recherchez-vous à ${LAUNCH_CITY.name} ?`}
              className="h-14 w-full rounded-pill border-0 bg-surface pl-12 pr-4 text-base text-ink shadow-raised placeholder:text-ink-subtle focus:outline-none focus:ring-4 focus:ring-brand-300/60"
            />
          </div>
          <button
            type="submit"
            className="h-14 rounded-pill bg-accent-600 px-7 text-base font-bold text-white shadow-raised transition-colors hover:bg-accent-700"
          >
            Rechercher
          </button>
        </Form>

        <ul
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
          aria-label="Exemples de recherche"
        >
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <a
                href={href("search", { query: { q: suggestion } })}
                className="inline-flex min-h-10 items-center whitespace-nowrap rounded-pill border border-white/30 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                {suggestion}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink href={href("newcomer")} variant="accent" size="lg" icon={<Compass aria-hidden className="h-5 w-5" />}>
            Nouveau à {LAUNCH_CITY.name} ?
          </ButtonLink>
          <ButtonLink
            href={href("publish")}
            variant="secondary"
            size="lg"
            icon={<Plus aria-hidden className="h-5 w-5" />}
            className="border-white/40 bg-transparent text-white hover:bg-white/10"
          >
            Publier une annonce
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
