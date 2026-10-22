import type { Metadata } from "next";
import { Suspense } from "react";
import { Scale } from "lucide-react";
import { href } from "@/config/routes";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CompareTable } from "@/modules/real-estate/components/compare-table";
import { listRealEstateBySlugs } from "@/modules/real-estate/server/queries";

export const metadata: Metadata = {
  title: "Comparer des biens",
  robots: { index: false, follow: true },
};

async function Comparison({ searchParams }: Pick<PageProps<"/immobilier/comparer">, "searchParams">) {
  const { annonces } = await searchParams;
  const slugs = (typeof annonces === "string" ? annonces : "").split(",").filter(Boolean);
  const properties = await listRealEstateBySlugs(slugs);
  if (properties.length < 2) {
    return (
      <EmptyState
        icon={<Scale aria-hidden className="h-6 w-6" />}
        title="Choisissez au moins deux biens"
        description="Sur les cartes de biens, utilisez « Comparer » (trois biens au plus). Une annonce retirée ou expirée n’apparaît plus ici."
        action={<ButtonLink href={href("realEstateMode", { params: { mode: "location" } })}>Voir les logements à louer</ButtonLink>}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <CompareTable properties={properties} now={new Date()} />
      <p className="text-sm text-ink-muted">
        Toutes ces informations sont déclarées par les annonceurs et peuvent avoir changé : confirmez-les avant toute visite. Cette comparaison
        n’est pas un classement.
      </p>
    </div>
  );
}

export default function ComparePage({ searchParams }: PageProps<"/immobilier/comparer">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Immobilier", href: href("realEstate") }, { label: "Comparer" }]} />
      <h1 className="text-3xl font-extrabold">Comparer des biens</h1>
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-card" />}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
