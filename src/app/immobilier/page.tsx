import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowRight, BedDouble, Building2, House, KeyRound, ShieldCheck } from "lucide-react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PropertySearchBox } from "@/modules/real-estate/components/property-search-box";
import { REAL_ESTATE_MODE_KEYS, REAL_ESTATE_MODES, type RealEstateMode } from "@/modules/real-estate/domain/modes";

export const metadata: Metadata = listMetadata({
  title: "Immobilier à San Pedro",
  description: "Logements à louer, biens et terrains à vendre, séjours temporaires et locaux professionnels, avec filtres précis.",
  path: "/immobilier",
  searchParams: {},
});

const ICONS: Record<RealEstateMode, typeof House> = {
  location: KeyRound,
  vente: House,
  temporaire: BedDouble,
  professionnel: Building2,
};

/** Accueil de l'immobilier : quatre entrées, recherche en langage courant, conseils. */
export default function RealEstatePage() {
  return (
    <Container className="flex flex-col gap-8 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Immobilier" }]} />
        <h1 className="text-3xl font-extrabold sm:text-4xl">Immobilier à San Pedro</h1>
        <p className="max-w-2xl text-ink-muted">
          Louer, acheter, séjourner ou installer son activité. Les informations sont déclarées par les annonceurs : aucune disponibilité
          n’est garantie et aucun quartier n’est présenté comme « meilleur ».
        </p>
        <PropertySearchBox mode="location" query="" />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {REAL_ESTATE_MODE_KEYS.map((mode) => {
          const Icon = ICONS[mode];
          return (
            <li key={mode}>
              <Link
                href={href("realEstateMode", { params: { mode } })}
                className="flex h-full items-start gap-4 rounded-card border border-border bg-surface p-5 shadow-card hover:border-brand-300"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-brand-50 text-brand-700">
                  <Icon aria-hidden className="h-6 w-6" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-bold">{REAL_ESTATE_MODES[mode].title}</span>
                  <span className="text-sm text-ink-muted">{REAL_ESTATE_MODES[mode].description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={href("realEstateAdvice")}
        className="flex items-center justify-between gap-3 rounded-card border border-lagoon-100 bg-success-soft p-5 hover:border-lagoon-700"
      >
        <span className="flex items-center gap-3">
          <ShieldCheck aria-hidden className="h-6 w-6 text-lagoon-700" />
          <span>
            <span className="block font-bold">Conseils pour se loger sans risque</span>
            <span className="text-sm text-ink-muted">Visite, contrat, caution, arnaques courantes.</span>
          </span>
        </span>
        <ArrowRight aria-hidden className="h-5 w-5 shrink-0" />
      </Link>
    </Container>
  );
}
