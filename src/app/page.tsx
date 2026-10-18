import { Compass, Search, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { SITE } from "@/config/site";
import { NAV_SECTIONS, type SectionKey } from "@/config/navigation";
import { LAUNCH_CITY } from "@/domain/city";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { NavItemLink } from "@/components/layout/nav-item-link";

const FAMILY_ICONS: Record<SectionKey, ReactNode> = {
  annonces: <Search aria-hidden className="h-6 w-6" />,
  decouvrir: <Compass aria-hidden className="h-6 w-6" />,
  services: <Wrench aria-hidden className="h-6 w-6" />,
};

/**
 * Accueil — version des fondations (phase 1).
 * Les sections alimentées par la base (lieux, annonces récentes, événements…)
 * sont ajoutées en phase 2, sans retirer les blocs ci-dessous.
 */
export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-500)_0%,transparent_55%),radial-gradient(ellipse_at_bottom_left,var(--color-accent-700)_0%,transparent_45%)] opacity-60"
        />
        <Container className="relative flex flex-col gap-5 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">
            {SITE.name} · Lancement à {LAUNCH_CITY.name}
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-display">{SITE.slogan}</h1>
          <p className="max-w-2xl text-lg text-brand-50">{SITE.tagline}</p>
        </Container>
      </section>

      <Container className="flex flex-col gap-8 py-12">
        <Alert tone="info" title="La plateforme est en cours de construction">
          Les lieux, annonces, événements et offres d’emploi apparaîtront ici dès leur publication et leur vérification.
          Aucun contenu fictif n’est affiché.
        </Alert>

        <section aria-labelledby="familles" className="flex flex-col gap-5">
          <h2 id="familles" className="text-2xl font-bold">
            Trois portes d’entrée sur votre ville
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {NAV_SECTIONS.map((family) => (
              <Card key={family.key}>
                <CardBody className="gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-control bg-brand-50 text-brand-700">
                    {FAMILY_ICONS[family.key]}
                  </span>
                  <CardTitle className="text-xl">{family.label}</CardTitle>
                  <p className="text-sm text-ink-muted">{family.tagline}</p>
                  <ul className="mt-1 flex flex-col">
                    {family.links.slice(0, 5).map((link) => (
                      <li key={link.label}>
                        <NavItemLink link={link} className="flex min-h-10 items-center text-sm font-medium hover:text-brand-700" />
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
