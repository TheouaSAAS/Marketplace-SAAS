import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SITE } from "@/config/site";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/spinner";
import { ListingUnavailable } from "@/modules/listings/components/listing-unavailable";
import { ListingView } from "@/modules/listings/components/listing-view";
import { getPublicListing, ownerAllowsIndexing } from "@/modules/listings/server/detail";
import { loadListingPage } from "@/modules/listings/server/page-data";
import { listingUrl } from "@/modules/listings/server/seo";

type Props = PageProps<"/annonces/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublicListing(slug);
  if (!listing) return { title: "Annonce", robots: { index: false, follow: true } };
  const url = listingUrl(slug);
  const description = listing.description.replace(/\s+/g, " ").slice(0, 160);
  return {
    title: listing.title,
    description,
    alternates: { canonical: url },
    // Un exemple de démonstration n'est jamais indexé.
    // Démonstration, ou annonceur qui refuse l'indexation (préférence de confidentialité).
    robots: listing.verification_status === "placeholder" || !(await ownerAllowsIndexing(listing.owner_id)) ? { index: false, follow: true } : undefined,
    openGraph: { title: listing.title, description, url, type: "website", locale: SITE.locale, siteName: SITE.name },
  };
}

async function ListingContent({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const data = await loadListingPage(slug);
  if (data.kind === "missing") notFound();
  if (data.kind === "unavailable") return <ListingUnavailable state={data.state} />;
  return <ListingView data={data} />;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Chargement de l’annonce">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-10 w-full max-w-2xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="aspect-[16/9] w-full rounded-card" />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    </div>
  );
}

/** Détail d'une annonce : publique, consultée par son auteur, ou expirée. */
export default function ListingPage({ params }: Props) {
  return (
    <Container className="py-6 sm:py-10">
      <Suspense fallback={<DetailSkeleton />}>
        <ListingContent params={params} />
      </Suspense>
    </Container>
  );
}
