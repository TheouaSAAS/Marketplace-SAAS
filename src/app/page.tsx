import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, Plus, Store } from "lucide-react";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HomeHero } from "@/components/home/home-hero";
import { HomeSections, HomeSectionsSkeleton } from "@/components/home/home-sections";
import { QuickAccess } from "@/components/home/quick-access";

/** Données structurées : le site et sa recherche (schema.org). */
const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  slogan: SITE.slogan,
  url: SITE.url,
  inLanguage: "fr",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE.url}${href("search")}?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

/**
 * Accueil : accroche et recherche (statiques, chargées instantanément), accès
 * rapides, puis sections alimentées par la base pour la ville choisie.
 */
export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD).replace(/</g, "\\u003c") }} />
      <HomeHero />
      <Container className="flex flex-col gap-12 pb-16">
        <QuickAccess />

        <Suspense fallback={<HomeSectionsSkeleton />}>
          <HomeSections />
        </Suspense>

        <section
          aria-labelledby="professionnels-cta"
          className="grid gap-6 rounded-card bg-brand-50 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center"
        >
          <div className="flex flex-col gap-3">
            <h2 id="professionnels-cta" className="text-2xl font-bold text-brand-900">
              Commerçant, artisan, organisateur ?
            </h2>
            <p className="text-brand-900/80">
              Présentez votre activité, publiez vos annonces et recevez des demandes de clients. La publication et la vitrine
              de base sont gratuites ; toute mise en avant payante est signalée « Sponsorisé ».
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <ButtonLink href={href("publish")} variant="accent" icon={<Plus aria-hidden className="h-4 w-4" />}>
              Publier une annonce
            </ButtonLink>
            <ButtonLink href={href("directory")} variant="secondary" icon={<Store aria-hidden className="h-4 w-4" />}>
              Espace professionnels
            </ButtonLink>
          </div>
        </section>

        <p className="flex flex-wrap items-center justify-center gap-2 text-center text-sm text-ink-muted">
          <BadgeCheck aria-hidden className="h-4 w-4 text-success" />
          Chaque information indique son statut et sa source.
          <Link href={href("verificationPolicy")} className="font-semibold text-brand-700 hover:underline">
            Comment nous vérifions
          </Link>
        </p>
      </Container>
    </>
  );
}
