import { Card, CardBody, CardTitle } from "@/components/ui/card";
import type { ContactChannel } from "../domain/presentation";
import type { ListingSeller } from "../server/detail";
import { ContactPanel } from "./contact-panel";
import type { AvailabilityStatus } from "../domain/availability";
import { FavoriteButton, LikeButton, ShareButton, WhatsAppShareLink } from "./listing-buttons";
import { SellerCard } from "./listing-sections";
import { ReportForm } from "./report-form";

/** Bien non disponible ou réservé : le contact reste possible, mais la demande change (savoir s'il se libère). */
const AVAILABILITY_NOTICES: Partial<Record<AvailabilityStatus, { title: string; body: string }>> = {
  unavailable: {
    title: "Non disponible pour le moment",
    body: "L’annonceur indique que ce bien n’est plus disponible. Vous pouvez lui écrire pour savoir s’il se libère ou s’il en propose un autre.",
  },
  reserved: {
    title: "Réservé pour le moment",
    body: "L’annonceur indique une réservation en cours. Écrivez-lui pour être prévenu si elle n’aboutit pas.",
  },
};

/** Colonne d'actions : contacter, annonceur, favoris, partage, signalement. */
export function ListingAside({
  listingId,
  slug,
  title,
  url,
  back,
  canContact,
  availability,
  isOwner,
  isPublic,
  signedIn,
  charterAccepted,
  channels,
  seller,
  contactName,
  favorite,
  likes,
}: {
  listingId: string;
  slug: string;
  title: string;
  url: string;
  back: string;
  canContact: boolean;
  availability: AvailabilityStatus;
  isOwner: boolean;
  isPublic: boolean;
  signedIn: boolean;
  charterAccepted: boolean;
  channels: ContactChannel[];
  seller: ListingSeller | null;
  contactName: string | null;
  favorite: boolean;
  likes: { count: number; liked: boolean } | null;
}) {
  const notice = AVAILABILITY_NOTICES[availability];
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Contacter et agir">
      <Card>
        <CardBody className="gap-4">
          <CardTitle className="text-lg">{canContact && notice ? notice.title : "Contacter l’annonceur"}</CardTitle>
          {canContact && notice && <p className="text-sm text-ink-muted">{notice.body}</p>}
          {canContact ? (
            <ContactPanel listingId={listingId} slug={slug} back={back} channels={channels} signedIn={signedIn} charterAccepted={charterAccepted} />
          ) : (
            <p className="text-sm text-ink-muted">
              {isOwner ? "C’est votre annonce : les messages reçus arrivent dans votre messagerie." : "Cette annonce ne peut plus être sollicitée."}
            </p>
          )}
        </CardBody>
      </Card>

      {seller && (
        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-lg">Annonceur</CardTitle>
            <SellerCard seller={seller} contactName={contactName} />
          </CardBody>
        </Card>
      )}

      {isPublic && (
        <div className="flex flex-wrap gap-2">
          <FavoriteButton listingId={listingId} active={favorite} back={back} />
          {likes && <LikeButton listingId={listingId} liked={likes.liked} count={likes.count} back={back} />}
          <ShareButton url={url} title={title} />
          <WhatsAppShareLink url={url} title={title} />
        </div>
      )}
      {isPublic && !isOwner && <ReportForm target={{ annonce: listingId }} back={back} />}
    </aside>
  );
}
