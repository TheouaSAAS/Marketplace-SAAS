import type { Metadata } from "next";
import { Suspense } from "react";
import { Heart } from "lucide-react";
import { href } from "@/config/routes";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes favoris",
  robots: { index: false, follow: false },
};

/** Espace protégé : la session est vérifiée ici (le proxy ne fait qu'un contrôle optimiste). */
async function FavoritesContent() {
  await requireAccount(href("favorites"));
  return (
    <EmptyState
      icon={<Heart aria-hidden className="h-6 w-6" />}
      title="Aucun favori pour le moment"
      description="Le bouton « Ajouter aux favoris » arrivera avec les fiches d’annonces, de lieux et d’événements. Vos favoris s’afficheront ici, visibles par vous seul."
      action={<ButtonLink href={href("listings")}>Parcourir les annonces</ButtonLink>}
    />
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
