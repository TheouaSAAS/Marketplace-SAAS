import { href } from "@/config/routes";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { STATE_NOTICES } from "../domain/presentation";
import { getSimilarListings } from "../server/detail";
import { SimilarListings } from "./listing-sections";

/** Annonce expirée ou archivée : explication claire et annonces proches, jamais d'erreur sèche. */
export async function ListingUnavailable({
  state,
}: {
  state: { listing_id: string; state: "expired" | "archived"; title: string; category_id: string; city_id: string };
}) {
  const notice = STATE_NOTICES[state.state];
  const similar = await getSimilarListings({
    id: state.listing_id,
    ownerId: "",
    cityId: state.city_id,
    categoryId: state.category_id,
    neighborhoodId: null,
    price: null,
    publishedAt: null,
  });
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Annonces", href: href("listings") }, { label: state.title }]} />
      <h1 className="text-2xl font-extrabold sm:text-3xl">{state.title}</h1>
      <Alert tone={notice.tone} title={notice.title}>
        {notice.body}
      </Alert>
      <SimilarListings items={similar} now={new Date()} />
    </div>
  );
}
