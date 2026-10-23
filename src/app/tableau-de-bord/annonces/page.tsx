import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { formatDate, formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LISTING_STATE_ORDER, LISTING_STATES, listingActions, STATS_DEFINITIONS, type ListingState } from "@/modules/dashboard/domain/dashboard";
import { ArchiveListingForm, AvailabilityForm, DeleteDraftForm, RenewListingForm } from "@/modules/dashboard/components/dashboard-forms";
import { getListingHistory, listDashboardListings, type DashboardListing } from "@/modules/dashboard/server/queries";
import { reopenAsDraftAction } from "@/modules/publishing/server/actions";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = { title: "Mes annonces" };

type Raw = Record<string, string | string[] | undefined>;

const NOTICES: Record<string, string> = {
  soumise: "Annonce soumise : l’équipe la relit avant publication et vous notifiera sa décision.",
  supprime: "Brouillon supprimé, avec ses photos.",
};
const DONE: Record<string, string> = {
  archivee: "Annonce archivée : elle a quitté le site et reste dans votre historique.",
  renouvelee: "Annonce renouvelée : elle repasse en relecture avant sa remise en ligne.",
};

const STATUS_WORDS: Record<string, string> = { draft: "brouillon", pending: "en attente", published: "publiée", rejected: "refusée", expired: "expirée", archived: "archivée" };
const AVAILABILITY_WORDS: Record<string, string> = { available: "disponible", unavailable: "indisponible", reserved: "réservée", unknown: "non précisée" };

async function History({ id }: { id: string }) {
  const history = await getListingHistory(id).catch(() => null);
  if (!history) return <p className="text-xs text-ink-muted">Historique momentanément indisponible.</p>;
  if (history.length === 0) return <p className="text-xs text-ink-muted">Aucun changement enregistré.</p>;
  return (
    <ul className="flex flex-col gap-0.5 text-xs text-ink-muted">
      {history.map((entry) => (
        <li key={`${entry.changed_at}-${entry.status_after}-${entry.availability_after}`}>
          {formatDateTime(entry.changed_at)} —{" "}
          {entry.action === "insert"
            ? `créée (${STATUS_WORDS[entry.status_after ?? ""] ?? entry.status_after})`
            : entry.status_before !== entry.status_after
              ? `${STATUS_WORDS[entry.status_before ?? ""] ?? entry.status_before} → ${STATUS_WORDS[entry.status_after ?? ""] ?? entry.status_after}`
              : `disponibilité : ${AVAILABILITY_WORDS[entry.availability_after ?? ""] ?? entry.availability_after}`}
        </li>
      ))}
    </ul>
  );
}

function ListingItem({ listing }: { listing: DashboardListing }) {
  const actions = listingActions(listing.status);
  const unavailable = listing.availability_status === "unavailable";
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CONTENT_STATUS_META[listing.status].tone}>{CONTENT_STATUS_META[listing.status].label}</Badge>
        {listing.status === "published" && unavailable && <Badge tone="neutral">Indisponible</Badge>}
        <span className="text-xs text-ink-muted">
          {listing.category.name} · modifiée le {formatDateTime(listing.updated_at)}
        </span>
      </div>
      <p className="font-bold">{listing.title || "Brouillon sans titre"}</p>
      {listing.status === "rejected" && listing.rejection_reason && <p className="text-sm text-danger">Motif du refus : {listing.rejection_reason}</p>}
      {listing.status === "published" && listing.expires_at && <p className="text-xs text-ink-muted">En ligne jusqu’au {formatDate(listing.expires_at)}</p>}
      {listing.status !== "draft" && (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            ["Vues", listing.stats.views],
            ["Favoris", listing.stats.favorites],
            ["Coordonnées vues", listing.stats.contact_reveals],
            ["Conversations", listing.stats.conversations],
          ].map(([label, value]) => (
            <div key={label} className="rounded-control bg-sand-50 p-2">
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 text-sm">
        {actions.includes("continuer") && (
          <Link href={href("publishEditor", { params: { id: listing.id } })} className="font-semibold underline">
            Continuer la rédaction
          </Link>
        )}
        {actions.includes("apercu") && (
          <Link href={href("publishPreview", { params: { id: listing.id } })} className="font-semibold underline">
            Voir l’aperçu
          </Link>
        )}
        {(actions.includes("retirer") || actions.includes("corriger")) && (
          <form action={reopenAsDraftAction}>
            <input type="hidden" name="annonce" value={listing.id} />
            <button type="submit" className="font-semibold underline">
              {listing.status === "rejected" ? "Corriger" : "Retirer de la modération pour modifier"}
            </button>
          </form>
        )}
        {actions.includes("voir") && (
          <Link href={href("listingDetail", { params: { slug: listing.slug } })} className="font-semibold underline">
            Voir l’annonce
          </Link>
        )}
        {actions.includes("disponibilite") && <AvailabilityForm id={listing.id} available={!unavailable} />}
        {actions.includes("renouveler") && <RenewListingForm id={listing.id} />}
        {actions.includes("archiver") && <ArchiveListingForm id={listing.id} />}
        {actions.includes("supprimer") && <DeleteDraftForm id={listing.id} />}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-muted">Historique</summary>
        <div className="mt-1">
          <Suspense fallback={<Skeleton className="h-8 w-full" />}>
            <History id={listing.id} />
          </Suspense>
        </div>
      </details>
    </li>
  );
}

async function Listings({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("myListings"));
  const raw = await searchParams;
  const notice = Object.keys(NOTICES).find((key) => raw[key] === "1");
  const done = typeof raw.fait === "string" ? DONE[raw.fait] : undefined;
  const statut = typeof raw.statut === "string" && Object.hasOwn(LISTING_STATES, raw.statut) ? (raw.statut as ListingState) : null;
  let listings: DashboardListing[];
  try {
    listings = await listDashboardListings(account.id);
  } catch (error) {
    logger.error("Mes annonces indisponibles", { module: "tableau-de-bord", error });
    return <ErrorState title="Vos annonces sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  const counts = Object.fromEntries(LISTING_STATE_ORDER.map((state) => [state, listings.filter((item) => item.status === state).length])) as Record<ListingState, number>;
  const shown = statut ? listings.filter((item) => item.status === statut) : listings;
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{NOTICES[notice]}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
      <nav aria-label="Filtrer par état" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {[null, ...LISTING_STATE_ORDER].map((state) => (
            <li key={state ?? "toutes"} className="shrink-0">
              <Link
                href={state ? href("myListings", { query: { statut: state } }) : href("myListings")}
                aria-current={statut === state ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-pill border px-3 text-sm whitespace-nowrap",
                  statut === state ? "border-brand-600 bg-brand-50 font-semibold" : "border-border hover:bg-sand-100",
                )}
              >
                {state ? `${LISTING_STATES[state].label} (${counts[state]})` : `Toutes (${listings.length})`}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {statut && <p className="text-sm text-ink-muted">{LISTING_STATES[statut].explain}</p>}
      {shown.length === 0 ? (
        <EmptyState
          title={statut ? `Aucune annonce « ${LISTING_STATES[statut].single.toLowerCase()} »` : "Aucune annonce"}
          description="Publiez une annonce : elle est relue avant sa mise en ligne."
          action={<ButtonLink href={href("publish")}>Publier une annonce</ButtonLink>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((listing) => (
            <ListingItem key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer font-medium">Que mesurent ces chiffres ? Quelles limites ?</summary>
        <dl className="mt-2 flex flex-col gap-1">
          {STATS_DEFINITIONS.map((item) => (
            <div key={item.label}>
              <dt className="inline font-semibold text-ink">{item.label} : </dt>
              <dd className="inline">{item.definition}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2">Ces chiffres décrivent une tendance, pas une audience exacte. Les offres d’emploi sont suivies dans l’espace emploi.</p>
      </details>
    </div>
  );
}

export default function MyListingsPage({ searchParams }: PageProps<"/tableau-de-bord/annonces">) {
  return (
    <>
      <Breadcrumbs items={[{ label: "Tableau de bord", href: href("dashboard") }, { label: "Mes annonces" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Mes annonces</h1>
        <ButtonLink href={href("publish")} variant="secondary" icon={<Plus aria-hidden className="h-4 w-4" />}>
          Publier une annonce
        </ButtonLink>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Listings searchParams={searchParams} />
      </Suspense>
    </>
  );
}
