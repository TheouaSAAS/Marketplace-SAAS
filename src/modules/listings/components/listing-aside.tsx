import { Card, CardBody, CardTitle } from "@/components/ui/card";
import type { ContactChannel } from "../domain/presentation";
import type { ListingSeller } from "../server/detail";
import { ContactPanel } from "./contact-panel";
import { FavoriteButton, LikeButton, ShareButton, WhatsAppShareLink } from "./listing-buttons";
import { SellerCard } from "./listing-sections";
import { ReportForm } from "./report-form";

/** Colonne d'actions : contacter, annonceur, favoris, partage, signalement. */
export function ListingAside({
  listingId,
  title,
  url,
  back,
  canContact,
  isOwner,
  isPublic,
  signedIn,
  channels,
  seller,
  contactName,
  favorite,
  likes,
}: {
  listingId: string;
  title: string;
  url: string;
  back: string;
  canContact: boolean;
  isOwner: boolean;
  isPublic: boolean;
  signedIn: boolean;
  channels: ContactChannel[];
  seller: ListingSeller | null;
  contactName: string | null;
  favorite: boolean;
  likes: { count: number; liked: boolean } | null;
}) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Contacter et agir">
      <Card>
        <CardBody className="gap-4">
          <CardTitle className="text-lg">Contacter l’annonceur</CardTitle>
          {canContact ? (
            <ContactPanel listingId={listingId} back={back} channels={channels} signedIn={signedIn} />
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
