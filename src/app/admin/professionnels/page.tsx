import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isCurator, isStaff } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { faqSchema, linksSchema } from "@/modules/businesses/domain/pro";
import { ProModerationForm, VerificationDecisionForm } from "@/modules/businesses/components/pro-forms";
import { listPendingProPages, listPendingVerifications, listProPhotos } from "@/modules/businesses/server/pro-queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Pages professionnelles à modérer — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const DECISIONS: Record<string, string> = {
  publiee: "Page publiée : ses photos sont en ligne et le professionnel est notifié.",
  refusee: "Page refusée : le professionnel reçoit votre motif.",
  verifiee: "Page marquée vérifiée, avec sa source.",
  "verification-refusee": "Vérification refusée : le professionnel reçoit votre motif.",
};

async function Queues({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("adminPros"));
  if (!isStaff(account.role) && !isCurator(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe de modération et à l’équipe locale.
      </Alert>
    );
  }
  const decision = (await searchParams).decision;
  const notice = typeof decision === "string" ? DECISIONS[decision] : undefined;
  let data;
  try {
    const [pages, verifications] = await Promise.all([isStaff(account.role) ? listPendingProPages() : Promise.resolve([]), isCurator(account.role) ? listPendingVerifications() : Promise.resolve([])]);
    const photos = await Promise.all(pages.map((page) => listProPhotos(page.id)));
    data = { pages: pages.map((page, index) => ({ page, photos: photos[index]! })), verifications };
  } catch (error) {
    logger.error("Files de modération des pages indisponibles", { module: "pages-pro", error });
    return <ErrorState title="Files de modération momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-8">
      {notice && <Alert tone="success">{notice}</Alert>}
      {isStaff(account.role) && (
        <section aria-labelledby="pages" className="flex flex-col gap-3">
          <h2 id="pages" className="text-xl font-bold">
            Pages en attente ({data.pages.length})
          </h2>
          {data.pages.length === 0 ? (
            <EmptyState title="Aucune page en attente" description="Les nouvelles pages et les modifications apparaîtront ici." />
          ) : (
            <ul className="flex flex-col gap-4">
              {data.pages.map(({ page, photos }) => {
                const faq = faqSchema.catch([]).parse(page.faq);
                const links = linksSchema.catch([]).parse(page.links);
                return (
                  <li key={page.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                    <div>
                      <h3 className="font-bold">{page.name}</h3>
                      <p className="text-xs text-ink-muted">
                        {page.category?.name ?? "Sans catégorie"} · soumise le {formatDateTime(page.updated_at)}
                      </p>
                    </div>
                    {photos.length > 0 && (
                      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Photos soumises">
                        {photos.map((photo, index) => (
                          <li key={photo.id}>
                            {photo.url && (
                              // Adresse signée du stockage privé : pas d'optimisation côté serveur.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photo.url} alt={photo.alt || `Photo ${index + 1}`} className="aspect-square w-full rounded-control object-cover" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {page.description && <p className="whitespace-pre-line text-sm">{page.description}</p>}
                    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                      <dt className="text-ink-muted">Prestations</dt>
                      <dd>{page.services.join(", ") || "—"}</dd>
                      <dt className="text-ink-muted">Zone</dt>
                      <dd>{page.service_area ?? "—"}</dd>
                      <dt className="text-ink-muted">Contacts</dt>
                      <dd>{[page.phone, page.email, page.website].filter(Boolean).join(" · ") || "—"}</dd>
                      <dt className="text-ink-muted">Liens</dt>
                      <dd>{links.map((link) => `${link.label} (${link.url})`).join(" · ") || "—"}</dd>
                      <dt className="text-ink-muted">FAQ</dt>
                      <dd>{faq.length ? `${faq.length} question(s)` : "—"}</dd>
                    </dl>
                    <p className="text-xs text-ink-muted">Vérifiez l’absence de fausse promesse, de contenu interdit et de coordonnées d’un tiers. Publier ne vaut pas vérification.</p>
                    <ProModerationForm pageId={page.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {isCurator(account.role) && (
        <section aria-labelledby="verifications" className="flex flex-col gap-3">
          <h2 id="verifications" className="text-xl font-bold">
            Demandes de vérification ({data.verifications.length})
          </h2>
          {data.verifications.length === 0 ? (
            <EmptyState title="Aucune demande de vérification" description="Les demandes des professionnels apparaîtront ici." />
          ) : (
            <ul className="flex flex-col gap-4">
              {data.verifications.map((request) => (
                <li key={request.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                  <h3 className="font-bold">
                    <Link className="underline" href={href("professionalDetail", { params: { slug: request.business.slug } })}>
                      {request.business.name}
                    </Link>
                  </h3>
                  <p className="text-xs text-ink-muted">Demande du {formatDateTime(request.created_at)}</p>
                  <p className="text-sm">
                    <span className="font-semibold">Élément proposé : </span>
                    {request.evidence}
                  </p>
                  <p className="text-xs text-ink-muted">Contrôlez l’élément vous-même (registre, appel, visite) : « Vérifié » engage la plateforme.</p>
                  <VerificationDecisionForm requestId={request.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default function AdminProsPage({ searchParams }: PageProps<"/admin/professionnels">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Administration", href: href("admin") }, { label: "Pages professionnelles" }]} />
      <h1 className="text-3xl font-extrabold">Pages professionnelles : modération et vérification</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Queues searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
