import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TourismExplorer } from "@/modules/tourism/components/tourism-explorer";

/** Variantes filtrées ou triées : canonique vers la rubrique, non indexées. */
export async function generateMetadata({ searchParams }: PageProps<"/tourisme">): Promise<Metadata> {
  return listMetadata({
    title: "Tourisme à San Pedro et dans ses environs",
    description: "Sites naturels, plages, lieux à visiter, hébergements, restaurants, activités et opérateurs : fiches datées, sources et avertissements.",
    path: "/tourisme",
    searchParams: await searchParams,
    keep: ["type"],
  });
}

export default function TourismPage({ searchParams }: PageProps<"/tourisme">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Découvrir et sortir", href: href("discover") }, { label: "Tourisme" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Tourisme</h1>
        <p className="max-w-2xl text-ink-muted">
          Tous les lieux de San Pedro et des environs enregistrés par l’équipe locale, avec leur statut de vérification. Une donnée manquante est
          signalée « à confirmer localement », jamais inventée.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <TourismExplorer searchParams={searchParams} entry={null} action={href("tourism")} />
      </Suspense>
    </Container>
  );
}
