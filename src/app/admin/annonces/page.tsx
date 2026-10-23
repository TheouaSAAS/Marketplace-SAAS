import type { Metadata } from "next";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isStaff } from "@/domain/roles";
import { formatDateTime, formatPrice, type PriceUnit } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { displayAttributes } from "@/modules/listings/domain/attributes";
import { fieldLabel } from "@/modules/publishing/domain/draft-fields";
import { checkListing } from "@/modules/publishing/domain/rules";
import { ListingModerationForm } from "@/modules/publishing/components/publish-forms";
import { listListingPhotos, listPendingListings, listSuggestions } from "@/modules/publishing/server/queries";
import { aiAvailability } from "@/server/ai";
import { requireAccount } from "@/server/auth";
import { ModerationHint } from "@/modules/admin/components/moderation-hint";

export const metadata: Metadata = {
  title: "Annonces à modérer — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const DECISIONS: Record<string, string> = {
  publiee: "Annonce publiée : ses photos sont en ligne et son auteur est notifié.",
  refusee: "Annonce refusée : son auteur reçoit votre motif.",
};

/** Équipe de modération : l'interface le vérifie, la base le garantit. */
async function Queue({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("adminListings"));
  if (!isStaff(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe de modération.
      </Alert>
    );
  }
  const decision = (await searchParams).decision;
  const aiHint = (await aiAvailability("moderation")).available;
  const notice = typeof decision === "string" ? DECISIONS[decision] : undefined;
  let items;
  try {
    const pending = await listPendingListings();
    items = await Promise.all(pending.map(async (listing) => ({ listing, photos: await listListingPhotos(listing.id), suggestions: await listSuggestions(listing.id) })));
  } catch (error) {
    logger.error("File de modération des annonces indisponible", { module: "publication", error });
    return <ErrorState title="File de modération momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {items.length === 0 ? (
        <EmptyState title="Aucune annonce en attente" description="Les nouvelles annonces apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map(({ listing, photos, suggestions }) => {
            const schema = listing.category.attribute_schema;
            const hits = checkListing(`${listing.title}\n${listing.description}\n${JSON.stringify(listing.attributes)}`);
            const reused = photos.filter((photo) => photo.otherDuplicates > 0).length;
            const accepted = suggestions.filter((item) => item.status === "acceptee");
            return (
              <li key={listing.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <div>
                  <h2 className="font-bold">{listing.title}</h2>
                  <p className="text-xs text-ink-muted">
                    {listing.category.name} · soumise le {formatDateTime(listing.updated_at)} · {formatPrice(listing.price, (listing.price_unit ?? "total") as PriceUnit)}
                  </p>
                </div>
                {hits.length > 0 && (
                  <Alert tone="danger" title="Formulations à vérifier">
                    {hits.map((hit) => `${hit.rule} (« ${hit.excerpt} »)`).join(" · ")}
                  </Alert>
                )}
                {reused > 0 && (
                  <Alert tone="warning" title="Photos déjà utilisées par un autre compte">
                    {reused} photo{reused > 1 ? "s" : ""} identique{reused > 1 ? "s" : ""} à celles d’une autre annonce : possible reprise d’annonce.
                  </Alert>
                )}
                {photos.length > 0 && (
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Photos soumises">
                    {photos.map((photo, index) => (
                      <li key={photo.id}>
                        {photo.url && (
                          // Adresse signée du stockage privé (équipe) : pas d'optimisation côté serveur.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo.url} alt={photo.alt || `Photo ${index + 1}`} className="aspect-square w-full rounded-control object-cover" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
                  {displayAttributes(schema, listing.attributes).map((item) => (
                    <div key={item.label} className="contents">
                      <dt className="text-ink-muted">{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="whitespace-pre-line text-sm">{listing.description}</p>
                {accepted.length > 0 && (
                  <p className="text-xs text-ink-muted">
                    Champs validés par l’auteur depuis l’assistant : {accepted.map((item) => `${fieldLabel(item.field, schema)} (${item.origin === "ia" ? "IA" : "règles"}, ${item.input_kind})`).join(", ")}.
                  </p>
                )}
                {aiHint && <ModerationHint type="annonce" id={listing.id} />}
                <ListingModerationForm listingId={listing.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminListingsPage({ searchParams }: PageProps<"/admin/annonces">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Administration", href: href("admin") }, { label: "Annonces à modérer" }]} />
      <h1 className="text-3xl font-extrabold">Annonces à modérer</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
