import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { formatDate, formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { workspaceRights } from "@/modules/businesses/domain/workspace";
import { loadWorkspace, WorkspaceHeader } from "@/modules/businesses/components/workspace-header";
import { listWorkspaceEvents, listWorkspaceListings, type ProListing } from "@/modules/businesses/server/workspace";
import { LISTING_STATES } from "@/modules/dashboard/domain/dashboard";

export const metadata: Metadata = { title: "Espace professionnel — annonces et offres" };

const JOB_SCHEMAS = ["emploi", "opportunite", "appel_offres"];

function ListingRow({ listing }: { listing: ProListing }) {
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CONTENT_STATUS_META[listing.status].tone}>{CONTENT_STATUS_META[listing.status].label}</Badge>
        {listing.status === "published" && listing.availability_status === "unavailable" && <Badge tone="neutral">Indisponible</Badge>}
        <span className="text-xs text-ink-muted">
          {listing.category_name} · modifiée le {formatDateTime(listing.updated_at)}
        </span>
      </div>
      {listing.status === "published" ? (
        <Link href={href("listingDetail", { params: { slug: listing.slug } })} className="font-bold underline">
          {listing.title}
        </Link>
      ) : (
        <p className="font-bold">{listing.title || "Brouillon sans titre"}</p>
      )}
      <p className="text-xs text-ink-muted">{LISTING_STATES[listing.status].explain}</p>
      {listing.status === "rejected" && listing.rejection_reason && <p className="text-sm text-danger">Correction demandée : {listing.rejection_reason}</p>}
      {listing.status === "published" && listing.expires_at && <p className="text-xs text-ink-muted">En ligne jusqu’au {formatDate(listing.expires_at)}</p>}
      {listing.status !== "draft" && (
        <p className="text-xs text-ink-muted">
          {listing.views} vue(s) · {listing.favorites} favori(s) · {listing.contact_reveals} coordonnées vues · {listing.conversations} conversation(s)
        </p>
      )}
    </li>
  );
}

async function Listings({ params }: { params: Promise<{ id: string }> }) {
  const { id, workspace } = await loadWorkspace(params, "proListings");
  let data;
  try {
    const [listings, events] = await Promise.all([listWorkspaceListings(id), listWorkspaceEvents(id)]);
    data = { listings, events };
  } catch (error) {
    logger.error("Annonces de l’espace pro indisponibles", { module: "espace-pro", error });
    return <ErrorState title="Annonces momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  const rights = workspaceRights(workspace.role);
  const jobs = data.listings.filter((listing) => JOB_SCHEMAS.includes(listing.schema ?? ""));
  const others = data.listings.filter((listing) => !JOB_SCHEMAS.includes(listing.schema ?? ""));
  return (
    <>
      <WorkspaceHeader workspace={workspace} section="Annonces et offres" />
      {rights.canManageListings ? (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={href("publish", { query: { page: id } })}>Publier une annonce pour la page</ButtonLink>
          <ButtonLink href={href("publishJob", { query: { page: id } })} variant="secondary">
            Publier une offre d’emploi
          </ButtonLink>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Rôle « Lecteur » : vous consultez les annonces sans pouvoir en publier.</p>
      )}
      <p className="text-sm text-ink-muted">
        Annonces rattachées à la page ou à son équipe, tous statuts. Chacune est relue avant publication ; un refus indique la correction demandée. Les
        prestations et produits se décrivent dans la page, les annonces servent aux offres ponctuelles.
      </p>
      {[
        ["Annonces", others],
        ["Offres d’emploi et opportunités", jobs],
      ].map(([title, items]) => (
        <section key={title as string} aria-label={title as string} className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">
            {title as string} ({(items as ProListing[]).length})
          </h2>
          {(items as ProListing[]).length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune pour l’instant.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {(items as ProListing[]).map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </ul>
          )}
        </section>
      ))}
      <section aria-labelledby="evenements" className="flex flex-col gap-3">
        <h2 id="evenements" className="text-lg font-bold">
          Événements de l’équipe ({data.events.length})
        </h2>
        {data.events.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun événement rattaché à l’équipe.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {data.events.map((event) => (
              <li key={event.id}>
                <span className="font-semibold">{event.title}</span> · {formatDateTime(event.starts_at)} · {event.status}
                {event.rejection_reason && <span className="text-danger"> · {event.rejection_reason}</span>}
              </li>
            ))}
          </ul>
        )}
        <Link href={href("eventPropose")} className="text-sm underline">
          Proposer un événement
        </Link>
      </section>
    </>
  );
}

export default function WorkspaceListingsPage({ params }: PageProps<"/espace-pro/[id]/annonces">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Listings params={params} />
    </Suspense>
  );
}
