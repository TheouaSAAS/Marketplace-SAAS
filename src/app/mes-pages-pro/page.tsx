import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TEAM_ROLES } from "@/modules/businesses/domain/pro";
import { CreateProPageForm } from "@/modules/businesses/components/pro-forms";
import { listMyProPages, pendingBusiness, proCategories, type MyProPage } from "@/modules/businesses/server/pro-queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes pages professionnelles",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const NOTICES: Record<string, string> = {
  soumise: "Page soumise : l’équipe la relit avant publication et vous notifiera sa décision.",
  equipe: "Bienvenue dans l’équipe : la page apparaît ci-dessous avec votre rôle.",
};

async function Pages({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("proPages"));
  const raw = await searchParams;
  const notice = Object.keys(NOTICES).find((key) => raw[key] === "1");
  let pages: MyProPage[];
  let categories: { id: string; name: string }[];
  let declared: Awaited<ReturnType<typeof pendingBusiness>> = null;
  try {
    [pages, categories, declared] = await Promise.all([listMyProPages(account.id), proCategories(), pendingBusiness(account.id).catch(() => null)]);
  } catch (error) {
    logger.error("Pages professionnelles indisponibles", { module: "pages-pro", error });
    return <ErrorState title="Vos pages sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-8">
      {notice && <Alert tone="success">{NOTICES[notice]}</Alert>}
      {pages.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Mes pages">
          {pages.map((page) => (
            <li key={page.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={CONTENT_STATUS_META[page.status].tone}>{CONTENT_STATUS_META[page.status].label}</Badge>
                <span className="text-xs text-ink-muted">Votre rôle : {page.role === "owner" && page.owner_id === account.id ? "Titulaire" : TEAM_ROLES[page.role].label}</span>
                <span className="text-xs text-ink-muted">· modifiée le {formatDateTime(page.updated_at)}</span>
              </div>
              <Link href={href("proPageEditor", { params: { id: page.id } })} className="font-bold underline">
                {page.name}
              </Link>
              {page.status === "rejected" && page.rejection_reason && <p className="text-sm text-danger">Motif du refus : {page.rejection_reason}</p>}
              <Link href={href("proWorkspace", { params: { id: page.id } })} className="text-sm font-semibold underline">
                Espace professionnel : demandes, annonces, statistiques
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="creer" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-6">
        <h2 id="creer" className="text-xl font-bold">
          {pages.length ? "Créer une autre page" : "Créer ma page professionnelle"}
        </h2>
        <p className="text-sm text-ink-muted">
          Gratuit. Vous la complétez (présentation, prestations, horaires, photos, FAQ), puis l’équipe la relit avant sa mise en ligne. Votre activité
          est déjà sur la plateforme ? Cherchez-la dans l’annuaire et revendiquez-la plutôt que d’en créer une seconde.
        </p>
        {declared && pages.length === 0 && <p className="text-sm">Prérempli avec l’activité indiquée à votre inscription : vérifiez et complétez.</p>}
        <CreateProPageForm categories={categories} defaults={pages.length === 0 ? (declared ?? undefined) : undefined} />
        <Link href={href("directory")} className="text-sm underline">
          Chercher mon activité dans l’annuaire
        </Link>
      </section>
    </div>
  );
}

export default function MyProPagesPage({ searchParams }: PageProps<"/mes-pages-pro">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Mes pages professionnelles" }]} />
      <h1 className="text-3xl font-extrabold">Mes pages professionnelles</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Pages searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
