import { Package } from "lucide-react";
import { href } from "@/config/routes";
import { Alert } from "@/components/ui/feedback";
import { CategoryVisual } from "@/components/content/category-visual";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { isFeatureEnabled } from "@/server/features";
import { displayAttributes } from "../domain/attributes";
import { listingState, STATE_NOTICES, type ContactChannel } from "../domain/presentation";
import type { LoadedListing } from "../server/page-data";
import { listingCategoryHref, listingJsonLd, listingUrl } from "../server/seo";
import { RealEstateNotice } from "@/modules/real-estate/components/real-estate-notice";
import { ListingAside } from "./listing-aside";
import { ListingHeader } from "./listing-header";
import { ListingJsonLd } from "./listing-json-ld";
import { ListingLocation } from "./listing-location";
import { CommentsSection, OwnerListings, SimilarListings } from "./listing-sections";
import { ListingAttributes, ListingDescription } from "./listing-text";

export function ListingView({ data }: { data: LoadedListing }) {
  const { listing, isPublic, userId, seller, point, engagement, comments, favorite, similar, others } = data;
  const now = new Date();
  const state = listingState(listing, now);
  const isOwner = userId === listing.owner_id;
  const back = href("listingDetail", { params: { slug: listing.slug } });
  const categoryHref = listingCategoryHref(listing);
  const channels: ContactChannel[] = [];
  if (listing.show_phone) channels.push("phone");
  if (listing.show_whatsapp) channels.push("whatsapp");
  if (listing.show_email) channels.push("email");

  return (
    <div className="flex flex-col gap-8">
      {isPublic && <ListingJsonLd items={listingJsonLd(listing, seller?.organization_name ?? null)} />}
      <Breadcrumbs
        items={[
          { label: "Annonces", href: href("search", { query: { type: "annonces" } }) },
          ...(listing.category && categoryHref ? [{ label: listing.category.name, href: categoryHref }] : []),
          { label: listing.title },
        ]}
      />
      {state !== "active" && (
        <Alert tone={STATE_NOTICES[state].tone} title={STATE_NOTICES[state].title}>
          {STATE_NOTICES[state].body}
          {state === "rejected" && listing.rejection_reason ? ` Motif : ${listing.rejection_reason}` : null}
        </Alert>
      )}
      {listing.verification_status === "placeholder" && (
        <Alert tone="warning" title="Exemple de démonstration">
          Cette annonce est fictive et sert à tester la plateforme : ne vous y fiez pas.
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <ListingHeader listing={listing} now={now} active={state === "active"} />
          {listing.category?.attribute_schema === "immobilier" && state === "active" && (
            <RealEstateNotice lastConfirmedAt={listing.last_confirmed_at} publishedAt={listing.published_at} now={now} />
          )}
          <div>
            <CategoryVisual icon={listing.category?.icon} fallback={Package} tone="brand" className="rounded-card lg:aspect-[21/9]" />
            <p className="mt-1 text-xs text-ink-subtle">Pas encore de photo : l’ajout de photos arrive avec la publication d’annonces.</p>
          </div>
          <ListingDescription text={listing.description} />
          <ListingAttributes items={displayAttributes(listing.category?.attribute_schema, listing.attributes)} />
          <ListingLocation
            precision={listing.public_location_precision}
            point={point}
            neighborhood={listing.neighborhood?.name ?? null}
            city={listing.city?.name ?? ""}
            mapEnabled={isFeatureEnabled("map")}
          />
        </div>
        <ListingAside
          listingId={listing.id}
          title={listing.title}
          url={listingUrl(listing.slug)}
          back={back}
          canContact={isPublic && state === "active" && !isOwner}
          isOwner={isOwner}
          isPublic={isPublic}
          signedIn={userId !== null}
          channels={channels}
          seller={seller}
          contactName={listing.contact_name}
          favorite={favorite}
          likes={engagement ? { count: engagement.likes, liked: engagement.liked } : null}
        />
      </div>

      {isPublic && (
        <CommentsSection
          listingId={listing.id}
          comments={comments}
          back={back}
          canComment={state === "active"}
          isManager={isOwner}
          signedIn={userId !== null}
        />
      )}
      <SimilarListings items={similar} now={now} />
      <OwnerListings items={others} now={now} />
    </div>
  );
}
