import type { Metadata } from "next";
import { Suspense } from "react";
import { Heart } from "lucide-react";
import { href } from "@/config/routes";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { ListingCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listFavoriteListings } from "@/modules/listings/server/favorites";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes favoris",
  robots: { index: false, follow: false },
};

/** Espace protégé : la session est vérifiée ici (le proxy ne fait qu'un contrôle optimiste). */
async function FavoritesContent() {
  const account = await requireAccount(href("favorites"));
  const { listings, unavailable } = await listFavoriteListings(account.id);
  const now = new Date();

  if (listings.length === 0 && unavailable === 0) {
    return (
      <EmptyState
        icon={<Heart aria-hidden className="h-6 w-6" />}
        title="Aucun favori pour le moment"
        description="Sur une annonce, « Ajouter aux favoris » la garde ici, visible par vous seul."
        action={<ButtonLink href={href("search", { query: { type: "annonces" } })}>Parcourir les annonces</ButtonLink>}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Visible par vous seul. L’annonceur ne sait pas que vous avez mis son annonce en favori.</p>
      {unavailable > 0 && (
        <Alert tone="info">
          {unavailable} favori{unavailable > 1 ? "s ne sont" : " n’est"} plus disponible{unavailable > 1 ? "s" : ""} (annonce expirée ou retirée).
        </Alert>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing, index) => (
          <li key={listing.id} className="flex [&>article]:flex-1">
            <ListingCard listing={listing} now={now} index={index} href={href("listingDetail", { params: { slug: listing.slug } })} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Mes favoris" }]} />
      <h1 className="text-3xl font-extrabold">Mes favoris</h1>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <FavoritesContent />
      </Suspense>
    </Container>
  );
}
