import Link from "next/link";
import { BadgeCheck, Info } from "lucide-react";
import { href } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ListingCard } from "@/components/content/content-cards";
import { SIMILAR_RULE } from "../domain/similar";
import type { ListingComment, ListingSeller, SimilarListing } from "../server/detail";
import type { ListingCardData } from "../server/queries";
import { CommentForm, CommentStatusButton } from "./comment-forms";
import { ReportForm } from "./report-form";

const MONTH_YEAR = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

/** Profil public de l'annonceur : nom affiché, ancienneté, statut professionnel (selon ses choix de confidentialité). */
export function SellerCard({ seller, contactName }: { seller: ListingSeller; contactName: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={seller.display_name} src={seller.avatar_url} size="lg" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate font-bold">{seller.organization_name ?? seller.display_name}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={seller.is_professional ? "brand" : "neutral"}>{seller.is_professional ? "Professionnel" : "Particulier"}</Badge>
        </div>
        {seller.member_since && <p className="text-sm text-ink-muted">Membre depuis {MONTH_YEAR.format(new Date(seller.member_since))}</p>}
        {seller.active_listings !== null && (
          <p className="text-sm text-ink-muted">
            {seller.active_listings} annonce{seller.active_listings > 1 ? "s" : ""} en ligne
          </p>
        )}
        {contactName && <p className="text-sm text-ink-muted">Contact indiqué : {contactName}</p>}
      </div>
    </div>
  );
}

function Rule({ children }: { children: string }) {
  return (
    <details className="text-sm text-ink-muted">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium hover:text-ink [&::-webkit-details-marker]:hidden">
        <Info aria-hidden className="h-4 w-4" />
        Pourquoi ces annonces ?
      </summary>
      <p className="mt-1 max-w-2xl">{children}</p>
    </details>
  );
}

function listingHref(slug: string) {
  return href("listingDetail", { params: { slug } });
}

export function SimilarListings({ items, now }: { items: SimilarListing[]; now: Date }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="similaires" className="flex flex-col gap-3">
      <h2 id="similaires" className="text-xl font-bold">
        Annonces similaires
      </h2>
      <Rule>{SIMILAR_RULE}</Rule>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ listing, reasons }, index) => (
          <li key={listing.id} className="flex [&>article]:flex-1">
            <ListingCard listing={listing} now={now} index={index} href={listingHref(listing.slug)} context={reasons.join(" · ")} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OwnerListings({ items, now }: { items: ListingCardData[]; now: Date }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="autres-annonces" className="flex flex-col gap-3">
      <h2 id="autres-annonces" className="text-xl font-bold">
        Autres annonces de cet annonceur
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((listing, index) => (
          <li key={listing.id} className="flex [&>article]:flex-1">
            <ListingCard listing={listing} now={now} index={index} href={listingHref(listing.slug)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Questions publiques et réponses de l'annonceur. Chacun supprime son
 * commentaire ; l'annonceur répond et peut masquer ; tout le monde peut
 * signaler.
 */
export function CommentsSection({
  listingId,
  comments,
  back,
  canComment,
  isManager,
  signedIn,
}: {
  listingId: string;
  comments: ListingComment[];
  back: string;
  canComment: boolean;
  isManager: boolean;
  signedIn: boolean;
}) {
  return (
    <section aria-labelledby="commentaires" className="flex flex-col gap-4">
      <h2 id="commentaires" className="text-xl font-bold">
        Questions et commentaires ({comments.length})
      </h2>
      {comments.length === 0 && <p className="text-sm text-ink-muted">Aucun commentaire pour l’instant.</p>}
      <ul className="flex flex-col gap-4">
        {comments.map((comment) => (
          <li key={comment.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
            <CommentBody comment={comment} back={back} isManager={isManager} signedIn={signedIn} />
            {comment.replies.map((reply) => (
              <div key={reply.id} className="ml-4 border-l-2 border-brand-200 pl-3">
                <CommentBody comment={reply} back={back} isManager={isManager} signedIn={signedIn} />
              </div>
            ))}
            {isManager && comment.replies.length === 0 && canComment && <CommentForm listingId={listingId} back={back} parentId={comment.id} />}
          </li>
        ))}
      </ul>
      {canComment ? (
        isManager ? null : <CommentForm listingId={listingId} back={back} />
      ) : (
        <p className="text-sm text-ink-muted">Cette annonce n’accepte plus de commentaires.</p>
      )}
    </section>
  );
}

function CommentBody({
  comment,
  back,
  isManager,
  signedIn,
}: {
  comment: Omit<ListingComment, "replies">;
  back: string;
  isManager: boolean;
  signedIn: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{comment.author_name}</span>
        {comment.is_seller && (
          <Badge tone="brand">
            <BadgeCheck aria-hidden className="h-3.5 w-3.5" />
            Annonceur
          </Badge>
        )}
        <span className="text-ink-subtle">{formatDate(comment.created_at, "short")}</span>
      </p>
      <p className="whitespace-pre-line break-words">{comment.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        {comment.is_mine && (
          <CommentStatusButton
            commentId={comment.id}
            status="deleted"
            label="Supprimer"
            back={back}
            confirmation="Supprimer définitivement ce commentaire ?"
          />
        )}
        {isManager && !comment.is_mine && (
          <CommentStatusButton
            commentId={comment.id}
            status="hidden"
            label="Masquer"
            back={back}
            confirmation="Masquer ce commentaire de votre annonce ?"
          />
        )}
        {signedIn && !comment.is_mine && <ReportForm target={{ commentaire: comment.id }} back={back} label="Signaler" />}
      </div>
    </div>
  );
}

export function ListingLinkBack() {
  return (
    <Link href={href("search", { query: { type: "annonces" } })} className="text-sm font-semibold text-brand-700 hover:underline">
      Voir toutes les annonces
    </Link>
  );
}
