import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SearchContent } from "@/modules/search/components/search-content";

export const metadata: Metadata = {
  title: "Recherche",
  description: "Annonces, lieux, professionnels, événements et guide pratique, avec filtres partageables.",
  // Pages de résultats : non indexées (contenu changeant, combinaisons infinies).
  robots: { index: false, follow: true },
};

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Chargement des résultats">
      <Skeleton className="h-12 w-full max-w-3xl rounded-pill" />
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-64 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}

/** Recherche transversale : annonces, lieux, professionnels, événements, guide. */
export default function SearchPage({ searchParams }: PageProps<"/recherche">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Recherche" }]} />
        <h1 className="text-3xl font-extrabold sm:text-4xl">Recherche</h1>
      </div>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
