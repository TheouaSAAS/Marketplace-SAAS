import "server-only";
import { hasAcceptedCharter } from "@/modules/trust/server/charter";
import { getSessionUser } from "@/server/auth";
import {
  getListingComments,
  getListingEngagement,
  getListingForSession,
  getListingImages,
  getListingPoint,
  getListingPublicState,
  getListingSeller,
  getOtherListingsFromOwner,
  getPublicListing,
  getSimilarListings,
  isFavoriteListing,
  type ListingDetail,
} from "./detail";

/**
 * Tout ce qu'affiche la page d'une annonce, selon qui la consulte :
 * - annonce publique : vue complète ;
 * - annonce non publique lue par son auteur ou l'équipe : vue avec état ;
 * - annonce expirée ou archivée : page d'explication ;
 * - sinon : introuvable.
 */
export async function loadListingPage(slug: string) {
  const [publicListing, user] = await Promise.all([getPublicListing(slug), getSessionUser()]);
  let listing: ListingDetail | null = publicListing;
  if (!listing && user) listing = await getListingForSession(slug);
  if (!listing) {
    const state = await getListingPublicState(slug);
    return state ? ({ kind: "unavailable", state } as const) : ({ kind: "missing" } as const);
  }

  const isPublic = publicListing !== null;
  const [seller, point, engagement, comments, favorite, similar, others, images] = await Promise.all([
    getListingSeller(listing.id, !isPublic),
    getListingPoint(listing.id, !isPublic),
    getListingEngagement(listing.id),
    getListingComments(listing.id),
    user ? isFavoriteListing(listing.id, user.id) : false,
    isPublic
      ? getSimilarListings({
          id: listing.id,
          ownerId: listing.owner_id,
          cityId: listing.city_id,
          categoryId: listing.category?.id ?? "",
          neighborhoodId: listing.neighborhood?.id ?? null,
          price: listing.price,
          publishedAt: listing.published_at,
        })
      : [],
    isPublic ? getOtherListingsFromOwner(listing.owner_id, listing.id) : [],
    // Photos publiées seulement : celles d'une annonce en attente restent privées.
    getListingImages(listing.id),
  ]);

  return {
    kind: "listing",
    listing,
    isPublic,
    userId: user?.id ?? null,
    charterAccepted: user ? await hasAcceptedCharter(user.id, "visiteur") : false,
    seller,
    point,
    engagement,
    comments,
    favorite,
    similar,
    others,
    images,
  } as const;
}

export type LoadedListing = Extract<Awaited<ReturnType<typeof loadListingPage>>, { kind: "listing" }>;
