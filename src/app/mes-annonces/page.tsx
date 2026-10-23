import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { formatDate, formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { reopenAsDraftAction } from "@/modules/publishing/server/actions";
import { listMyListings, type MyListing } from "@/modules/publishing/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes annonces",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const NOTICES: Record<string, string> = {
  soumise: "Annonce soumise : l’équipe la relit avant publication et vous notifiera sa décision.",
  supprime: "Brouillon supprimé, avec ses photos.",
};

function Actions({ listing }: { listing: MyListing }) {
  if (listing.status === "draft") {
    return (
      <Link href={href("publishEditor", { params: { id: listing.id } })} className="text-sm font-semibold underline">
        Continuer la rédaction
      </Link>
    );
  }
  if (listing.status === "pending" || listing.status === "rejected") {
    return (
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={href("publishPreview", { params: { id: listing.id } })} className="font-semibold underline">
          Voir l’aperçu
        </Link>
        <form action={reopenAsDraftAction}>
          <input type="hidden" name="annonce" value={listing.id} />
          <button type="submit" className="font-semibold underline">
            {listing.status === "rejected" ? "Corriger" : "Retirer de la modération pour modifier"}
          </button>
        </form>
      </div>
    );
  }
  if (listing.status === "published") {
    return (
      <Link href={href("listingDetail", { params: { slug: listing.slug } })} className="text-sm font-semibold underline">
        Voir l’annonce
      </Link>
    );
  }
  return null;
}

async function Listings({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("myListings"));
  const raw = await searchParams;
  const notice = Object.keys(NOTICES).find((key) => raw[key] === "1");
  let listings: MyListing[];
  try {
    listings = await listMyListings(account.id);
  } catch (error) {
    logger.error("Mes annonces indisponibles", { module: "publication", error });
    return <ErrorState title="Vos annonces sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{NOTICES[notice]}</Alert>}
      {listings.length === 0 ? (
        <EmptyState title="Aucune annonce" description="Publiez votre première annonce : elle est relue avant sa mise en ligne." action={<ButtonLink href={href("publish")}>Publier une annonce</ButtonLink>} />
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={CONTENT_STATUS_META[listing.status].tone}>{CONTENT_STATUS_META[listing.status].label}</Badge>
                <span className="text-xs text-ink-muted">{listing.category.name}</span>
                <span className="text-xs text-ink-muted">· modifiée le {formatDateTime(listing.updated_at)}</span>
              </div>
              <p className="font-bold">{listing.title || "Brouillon sans titre"}</p>
              {listing.status === "rejected" && listing.rejection_reason && <p className="text-sm text-danger">Motif du refus : {listing.rejection_reason}</p>}
              {listing.status === "published" && listing.expires_at && <p className="text-xs text-ink-muted">En ligne jusqu’au {formatDate(listing.expires_at)}</p>}
              <Actions listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MyListingsPage({ searchParams }: PageProps<"/mes-annonces">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Mes annonces" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Mes annonces</h1>
        <ButtonLink href={href("publish")} variant="secondary" icon={<Plus aria-hidden className="h-4 w-4" />}>
          Publier une annonce
        </ButtonLink>
      </div>
      <p className="text-sm text-ink-muted">Brouillons (privés), annonces en attente de relecture, publiées, refusées ou expirées. Les offres d’emploi sont suivies dans l’espace emploi.</p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Listings searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
