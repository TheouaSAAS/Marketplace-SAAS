import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Search } from "lucide-react";
import { NAV_SECTIONS, NEWCOMER_LINK } from "@/config/navigation";
import { href } from "@/config/routes";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { HeaderSearch } from "@/components/layout/header-search";

export const metadata: Metadata = {
  title: "Recherche",
  robots: { index: false, follow: true },
};

async function SearchNotice({ searchParams }: Pick<PageProps<"/recherche">, "searchParams">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 120) : "";
  return (
    <EmptyState
      icon={<Search aria-hidden className="h-6 w-6" />}
      title={query ? `Votre recherche : « ${query} »` : "Que recherchez-vous à San Pedro ?"}
      description="Le moteur de recherche (annonces, lieux, professionnels, événements, avec filtres et proximité) est en préparation. En attendant, parcourez les rubriques ci-dessous."
    />
  );
}

/** Recherche globale — écran d'attente (le moteur est livré au niveau 7). */
export default function SearchPage({ searchParams }: PageProps<"/recherche">) {
  return (
    <Container className="flex flex-col gap-8 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Recherche" }]} />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Recherche</h1>
          <Badge tone="warning">En préparation</Badge>
        </div>
        <HeaderSearch id="recherche-page" className="max-w-2xl lg:hidden" />
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <SearchNotice searchParams={searchParams} />
      </Suspense>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...NAV_SECTIONS.map((section) => ({ label: section.label, route: section.route })), NEWCOMER_LINK].map((item) => (
          <li key={item.label}>
            <Link
              href={href(item.route)}
              className="flex min-h-14 items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3 font-semibold hover:border-brand-300 hover:text-brand-700"
            >
              {item.label}
              <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
