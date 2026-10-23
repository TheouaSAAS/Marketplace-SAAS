import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { formatDate, formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { PhotoManager } from "@/modules/publishing/components/photo-manager";
import { parseOpeningHours } from "@/modules/shops/domain/hours";
import { completeness, PRO_BADGES, ROLE_RANK, TEAM_ROLES } from "@/modules/businesses/domain/pro";
import { ProPageForm } from "@/modules/businesses/components/pro-page-form";
import { RespondForm, SubmitProPageForm, VerificationRequestForm } from "@/modules/businesses/components/pro-forms";
import { CreateTeamForm, TeamPanel } from "@/modules/businesses/components/team-panel";
import { getManagedPage, listPlans, listProPhotos, proCategories } from "@/modules/businesses/server/pro-queries";
import { aiAvailability } from "@/server/ai";
import { requireAccount } from "@/server/auth";
import { getCityContext } from "@/server/city-context";

export const metadata: Metadata = {
  title: "Gérer ma page professionnelle",
  robots: { index: false, follow: false },
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-6">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Manage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const account = await requireAccount(href("proPageEditor", { params: { id } }));
  await connection();
  let loaded;
  try {
    const data = await getManagedPage(id, account.id);
    if (data) {
      const { current } = await getCityContext();
      const [photos, categories, neighborhoods, ai, plans] = await Promise.all([
        listProPhotos(id),
        proCategories(),
        current.id ? listNeighborhoods(current.id) : Promise.resolve([]),
        aiAvailability(),
        listPlans(),
      ]);
      loaded = { data, photos, categories, neighborhoods, ai, plans };
    }
  } catch (error) {
    logger.error("Gestion de la page indisponible", { module: "pages-pro", error });
    return <ErrorState title="Page momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  if (!loaded) notFound();
  const { data, photos, categories, neighborhoods, ai, plans } = loaded;
  const { page, role, team, invitations, reviews, verificationRequests } = data;
  const canEdit = ROLE_RANK[role] >= ROLE_RANK.editor;
  const isHolder = page.owner_id === account.id;
  const hours = parseOpeningHours(page.opening_hours);
  const check = completeness({ ...page, category: page.category_id, opening_hours: hours, photoCount: photos.length });
  const pendingRequest = verificationRequests.find((item) => item.status === "pending");
  const lastDecision = verificationRequests.find((item) => item.status !== "pending");
  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CONTENT_STATUS_META[page.status].tone}>{CONTENT_STATUS_META[page.status].label}</Badge>
          <span className="text-sm text-ink-muted">Votre rôle : {isHolder ? "Titulaire" : TEAM_ROLES[role].label}</span>
        </div>
        <h1 className="text-3xl font-extrabold">{page.name}</h1>
        {page.status === "published" && (
          <Link href={href("professionalDetail", { params: { slug: page.slug } })} className="text-sm font-semibold underline">
            Voir la page publique
          </Link>
        )}
      </div>

      {page.status === "rejected" && page.rejection_reason && (
        <Alert tone="danger" title="Page refusée">
          Motif : {page.rejection_reason}. Corrigez puis soumettez-la de nouveau.
        </Alert>
      )}
      {page.status === "pending" && <Alert tone="info">Page en cours de relecture par l’équipe : vous serez notifié de la décision.</Alert>}
      {page.status === "published" && (
        <Alert tone="info">Toute modification du contenu renvoie la page en relecture ; la disponibilité et les demandes de devis se mettent à jour tout de suite.</Alert>
      )}

      <Section id="completude" title={`Profil complété : ${check.done}/${check.total}`}>
        {check.complete ? (
          <p className="text-sm text-success">Toutes les rubriques sont remplies : la page porte le badge « {PRO_BADGES.complete.label} ».</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-ink-muted">
            {check.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-muted">{PRO_BADGES.complete.definition}</p>
        {canEdit && (page.status === "draft" || page.status === "rejected") && <SubmitProPageForm pageId={id} />}
      </Section>

      <ProPageForm
        readOnly={!canEdit}
        categories={categories}
        neighborhoods={neighborhoods.map(({ id: neighborhoodId, name }) => ({ id: neighborhoodId, name }))}
        ai={ai}
        values={{
          id,
          name: page.name,
          categoryId: page.category_id,
          neighborhoodId: page.neighborhood_id,
          description: page.description,
          services: page.services,
          serviceArea: page.service_area,
          availabilityNote: page.availability_note,
          acceptsQuotes: page.accepts_quotes,
          phone: page.phone,
          whatsapp: page.whatsapp,
          email: page.email,
          website: page.website,
          openingHours: hours,
          links: page.links,
          faq: page.faq,
        }}
      />

      <Section id="photos" title="Photos">
        {canEdit ? (
          <PhotoManager target="pro" listingId={id} userId={account.id} initial={photos} aiAvailable={false} />
        ) : (
          <p className="text-sm text-ink-muted">{photos.length} photo(s). Rôle « Lecteur » : consultation seulement.</p>
        )}
        <p className="text-xs text-ink-muted">Douze au plus, la première sert de couverture. Elles deviennent publiques quand l’équipe publie la page.</p>
      </Section>

      <Section id="equipe" title="Équipe">
        {page.organization_id ? (
          <TeamPanel pageId={id} organizationId={page.organization_id} members={team} invitations={invitations} myRole={role} me={account.id} now={now} />
        ) : isHolder ? (
          <>
            <p className="text-sm text-ink-muted">Créez l’équipe pour inviter des collaborateurs (administrateurs, éditeurs, lecteurs) par lien, sans partager votre compte.</p>
            <CreateTeamForm pageId={id} />
          </>
        ) : (
          <p className="text-sm text-ink-muted">Pas d’équipe pour cette page.</p>
        )}
      </Section>

      <Section id="verification" title="Vérification">
        <p className="text-sm text-ink-muted">{PRO_BADGES.verified.definition}</p>
        {page.verification_status === "verified" && page.verified_at ? (
          <p className="text-sm text-success">Page vérifiée le {formatDate(page.verified_at)}.</p>
        ) : pendingRequest ? (
          <p className="text-sm">Demande envoyée le {formatDateTime(pendingRequest.created_at)} : badge « {PRO_BADGES.pending.label} » en attendant le contrôle.</p>
        ) : page.status !== "published" ? (
          <p className="text-sm text-ink-muted">La vérification se demande une fois la page publiée.</p>
        ) : canEdit ? (
          <>
            {lastDecision?.status === "rejected" && <Alert tone="warning">Dernière demande refusée{lastDecision.decision_note ? ` : ${lastDecision.decision_note}` : "."}</Alert>}
            <VerificationRequestForm pageId={id} />
          </>
        ) : null}
      </Section>

      <Section id="avis" title={`Avis reçus (${reviews.length})`}>
        {reviews.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun avis pour l’instant. Les avis sont relus par l’équipe avant publication ; vous pouvez y répondre publiquement.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((review) => (
              <li key={review.id} className="flex flex-col gap-2 rounded-control border border-border p-3">
                <p className="text-sm">
                  <span className="font-semibold">{review.rating}/5</span> · {review.author_name} · {formatDate(review.created_at)}
                  {review.status === "pending" && <Badge tone="info" className="ml-2">En relecture</Badge>}
                </p>
                {review.body && <p className="whitespace-pre-line text-sm">{review.body}</p>}
                {review.status === "published" && canEdit && <RespondForm pageId={id} reviewId={review.id} current={review.response_body} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="offres" title="Visibilité et offres">
        <p className="text-sm text-ink-muted">
          La page professionnelle est gratuite. Le paiement en ligne n’est pas encore ouvert : aucune somme ne vous est demandée, et aucune mise en avant ne
          peut être achetée pour l’instant. Une mise en avant sera toujours signalée « {PRO_BADGES.sponsored.label} » et n’influence ni la vérification ni les
          avis.
        </p>
        {plans.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => (
              <li key={plan.code} className="flex flex-col gap-1 rounded-control border border-border p-3 text-sm">
                <p className="font-bold">{plan.name}</p>
                <p className="text-ink-muted">{plan.is_active ? "Disponible" : "Pas encore ouverte"}</p>
                <ul className="list-disc pl-4 text-ink-muted">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function ManageProPage({ params }: PageProps<"/mes-pages-pro/[id]">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mes pages professionnelles", href: href("proPages") }, { label: "Gérer" }]} />
      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
        <Manage params={params} />
      </Suspense>
    </Container>
  );
}
