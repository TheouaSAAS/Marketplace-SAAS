import Link from "next/link";
import { Suspense } from "react";
import { LogIn, Plus } from "lucide-react";
import { SITE } from "@/config/site";
import { getCityContext } from "@/server/city-context";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";
import { CitySelector, CitySelectorFallback } from "./city-selector";
import { HeaderSearch } from "./header-search";
import { MainNav } from "./main-nav";
import { MobileNav } from "./mobile-nav";
import { RouteButton } from "./nav-item-link";

/** Lit le cookie de ville : rendu à la requête, derrière <Suspense> (Cache Components). */
async function CurrentCitySelector() {
  const { cities, current } = await getCityContext();
  return <CitySelector cities={cities} currentSlug={current.slug} />;
}

/**
 * En-tête commun à toutes les pages.
 * Mobile : logo, ville, menu (publication et connexion dans le menu).
 * ≥ 640 px : bouton Publier. ≥ 1024 px : navigation des familles et Connexion.
 * ≥ 1280 px : champ de recherche.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <Container className="flex h-16 items-center gap-2 sm:gap-3">
        <Link href="/" aria-label={`${SITE.name} — accueil`} className="shrink-0 rounded-control">
          <Logo />
        </Link>

        <MainNav className="ml-2 hidden lg:flex" />

        <div className="ml-auto flex items-center gap-2">
          <HeaderSearch id="recherche-entete" className="hidden w-60 xl:block" />
          <Suspense fallback={<CitySelectorFallback />}>
            <CurrentCitySelector />
          </Suspense>
          <RouteButton route="login" variant="ghost" icon={<LogIn aria-hidden className="h-4 w-4" />} className="hidden lg:inline-flex">
            Connexion
          </RouteButton>
          <RouteButton route="publish" variant="accent" icon={<Plus aria-hidden className="h-4 w-4" />} className="hidden sm:inline-flex">
            Publier
          </RouteButton>
          <MobileNav className="lg:hidden" searchSlot={<HeaderSearch id="recherche-menu" />} />
        </div>
      </Container>
    </header>
  );
}
