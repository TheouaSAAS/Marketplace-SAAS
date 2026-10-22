import Link from "next/link";
import { ArrowRight, Info, MapPin } from "lucide-react";
import { categoryHref } from "@/config/routes";
import { displayedVerification, type VerificationStatus } from "@/domain/verification";
import { formatDateTime, formatPrice } from "@/lib/format";
import { logger } from "@/lib/logger";
import { listUpcomingEvents } from "@/modules/events/server/queries";
import { listListingsByCategories } from "@/modules/listings/server/queries";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { listPlacesByCategories } from "@/modules/places/server/queries";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { Alert } from "@/components/ui/feedback";
import { VerificationBadge } from "@/components/ui/verification";
import { BLOCKS, type BlockContent, type PlanBlock } from "../domain/plan";

interface PlanItem {
  id: string;
  title: string;
  meta: string[];
  status: VerificationStatus;
  verifiedAt: string | null;
}

async function loadItems(content: BlockContent, cityId: string): Promise<PlanItem[] | null> {
  switch (content.kind) {
    case "none":
      return null;
    case "events":
      return (await listUpcomingEvents(cityId, 3)).map((event) => ({
        id: event.id,
        title: event.title,
        meta: [formatDateTime(event.starts_at), ...(event.schedule_status === "cancelled" ? ["Annulé"] : [])],
        status: event.verification_status,
        verifiedAt: event.verified_at,
      }));
    case "neighborhoods":
      return (await listNeighborhoods(cityId)).map((neighborhood) => ({
        id: neighborhood.id,
        title: neighborhood.name,
        meta: [],
        status: neighborhood.verification_status,
        verifiedAt: neighborhood.verified_at,
      }));
    case "listings": {
      const ids = categoryIdsWithDescendants(await listCategories(), content.categories);
      return (await listListingsByCategories(cityId, ids, 3)).map((listing) => ({
        id: listing.id,
        title: listing.title,
        meta: [listing.category?.name, listing.neighborhood?.name, formatPrice(listing.price, listing.price_unit ?? "total")].filter(
          (part): part is string => Boolean(part),
        ),
        status: listing.verification_status,
        verifiedAt: listing.verified_at,
      }));
    }
    case "places": {
      const ids = categoryIdsWithDescendants(await listCategories(), content.categories);
      return (await listPlacesByCategories(cityId, ids, 3)).map((place) => ({
        id: place.id,
        title: place.name,
        meta: [place.category?.name, place.neighborhood?.name].filter((part): part is string => Boolean(part)),
        status: place.verification_status,
        verifiedAt: place.verified_at,
      }));
    }
  }
}

/** Contenus réels d'un bloc (lus en base), avec signalement des données à vérifier. */
export async function PlanBlockContent({ block, cityId, now }: { block: PlanBlock; cityId: string; now: Date }) {
  const definition = BLOCKS[block.key];
  let items: PlanItem[] | null;
  try {
    items = await loadItems(definition.content, cityId);
  } catch (error) {
    logger.warn("Contenu du plan indisponible", { module: "nouvel-arrivant", bloc: block.key, error });
    return <Alert tone="warning">Ces contenus sont momentanément indisponibles.</Alert>;
  }
  if (items === null) return null;
  if (items.length === 0) {
    return (
      <p className="rounded-control bg-sand-100 px-4 py-3 text-sm text-ink-muted">
        Aucun contenu publié pour l’instant dans cette rubrique. Les liens ci-dessous vous mèneront à la rubrique dès son
        ouverture.
      </p>
    );
  }

  const displayed = items.map((item) => ({ ...item, shown: displayedVerification(item.status, item.verifiedAt, now) }));
  const unverified = displayed.some((item) => item.shown !== "verified");

  return (
    <div className="flex flex-col gap-3">
      {unverified && (
        <p className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm text-yellow-900">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Certaines informations ci-dessous ne sont pas encore vérifiées : confirmez-les avant de vous déplacer ou de vous engager.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
        {displayed.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="font-semibold">{item.title}</p>
              {item.meta.length > 0 && (
                <p className="flex items-center gap-1 text-sm text-ink-muted">
                  <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate first-letter:uppercase">{item.meta.join(" · ")}</span>
                </p>
              )}
            </div>
            <VerificationBadge status={item.shown} className="self-start sm:self-center" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** En-tête d'un bloc : titre, raisons (transparence), note, actions. Le contenu est passé en enfant. */
export function PlanBlockCard({ block, index, children }: { block: PlanBlock; index: number; children: React.ReactNode }) {
  const definition = BLOCKS[block.key];
  return (
    <li className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-600 text-sm font-bold text-white" aria-hidden="true">
          {index + 1}
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">{definition.title}</h2>
          <p className="text-sm text-ink-muted">{definition.description}</p>
        </div>
      </div>
      <div className="rounded-control bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <p className="font-semibold">Pourquoi ce conseil ?</p>
        <ul className="mt-1 ml-5 list-disc">
          {block.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      {block.note && <p className="text-sm text-ink-muted">{block.note}</p>}
      {children}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {definition.actions.map((action) => (
          <Link
            key={action.label}
            href={categoryHref(action.route, action.category)}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
          >
            {action.label} <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        ))}
      </div>
    </li>
  );
}
