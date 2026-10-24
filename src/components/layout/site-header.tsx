import Link from "next/link";
import { Suspense } from "react";
import { Heart, Plus } from "lucide-react";
import { SITE } from "@/config/site";
import { href } from "@/config/routes";
import { getCityContext } from "@/server/city-context";
import { AccountEntry, AccountEntryFallback } from "@/modules/accounts/components/account-entry";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";
import { CitySelector, CitySelectorFallback } from "./city-selector";
import { HeaderSearch } from "./header-search";
import { MainNav, MainNavView } from "./main-nav";
import { MobileNav } from "./mobile-nav";
import { RouteButton } from "./nav-item-link";

/** Lit le cookie de ville : rendu à la requête, derrière <Suspense> (Cache Components). */
async function CurrentCitySelector() {
  const { cities, current } = await getCityContext();
  return <CitySelector cities={cities} currentSlug={current.slug} />;
}

/**
 * En-tête commun.
 * Mobile : logo, ville, menu ; les actions principales sont dans la barre basse.
 * ≥ 640 px : bouton Publier. ≥ 1024 px : recherche, favoris, compte, et barre
 * des rubriques sur une seconde ligne (navigation structurée sans surcharge).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 print:hidden border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <Container className="flex h-16 items-center gap-2 sm:gap-3">
        <Link href="/" aria-label={`${SITE.name} — accueil`} className="shrink-0 rounded-control">
          <Logo />
        </Link>

        <HeaderSearch id="recherche-entete" className="ml-4 hidden max-w-xl flex-1 lg:block" />

        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<CitySelectorFallback />}>
            <CurrentCitySelector />
          </Suspense>
          <Link
            href={href("favorites")}
            aria-label="Mes favoris"
            title="Mes favoris"
            className={buttonClasses({ variant: "ghost", size: "icon", className: "hidden lg:inline-flex" })}
          >
            <Heart aria-hidden className="h-5 w-5" />
          </Link>
          <div className="hidden lg:block">
            <Suspense fallback={<AccountEntryFallback variant="desktop" />}>
              <AccountEntry variant="desktop" />
            </Suspense>
          </div>
          <RouteButton route="publish" variant="accent" icon={<Plus aria-hidden className="h-4 w-4" />} className="hidden sm:inline-flex">
            Publier
          </RouteButton>
          <MobileNav
            className="lg:hidden"
            searchSlot={<HeaderSearch id="recherche-menu" />}
            accountSlot={
              <Suspense fallback={<AccountEntryFallback variant="mobile" />}>
                <AccountEntry variant="mobile" />
              </Suspense>
            }
          />
        </div>
      </Container>
      <div className="hidden border-t border-border lg:block">
        <Container>
          <Suspense fallback={<MainNavView className="flex h-14" pathname={null} />}>
            <MainNav className="flex h-14" />
          </Suspense>
        </Container>
      </div>
    </header>
  );
}
