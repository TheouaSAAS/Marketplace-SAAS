import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TEAM_ROLES } from "@/modules/businesses/domain/pro";
import { listMyProPages, type MyProPage } from "@/modules/businesses/server/pro-queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Espace professionnel",
  robots: { index: false, follow: false },
};

async function Pages() {
  const account = await requireAccount(href("pro"));
  let pages: MyProPage[];
  try {
    pages = await listMyProPages(account.id);
  } catch (error) {
    logger.error("Espace professionnel indisponible", { module: "espace-pro", error });
    return <ErrorState title="Espace professionnel momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  if (pages.length === 0) {
    return (
      <EmptyState
        title="Aucune page professionnelle"
        description="Créez votre page (gratuite) ou rejoignez l’équipe d’une page existante grâce au lien d’invitation de son administrateur."
        action={<ButtonLink href={href("proPages")}>Créer ma page professionnelle</ButtonLink>}
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Mes espaces">
      {pages.map((page) => (
        <li key={page.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CONTENT_STATUS_META[page.status].tone}>{CONTENT_STATUS_META[page.status].label}</Badge>
            <span className="text-xs text-ink-muted">{page.owner_id === account.id ? "Titulaire" : TEAM_ROLES[page.role].label}</span>
          </div>
          <Link href={href("proWorkspace", { params: { id: page.id } })} className="text-lg font-bold underline">
            {page.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ProSpacePage() {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Espace professionnel" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Espace professionnel</h1>
        <ButtonLink href={href("proPages")} variant="secondary">
          Créer une page
        </ButtonLink>
      </div>
      <p className="max-w-2xl text-ink-muted">
        Un espace par page professionnelle : annonces et offres, demandes reçues, statistiques, vérification et visibilité. Chaque équipe ne voit que les
        données de sa page, selon son rôle.
      </p>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <Pages />
      </Suspense>
    </Container>
  );
}
