import "server-only";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { listingStructuredData } from "../domain/structured-data";
import type { ListingDetail } from "./detail";

export function listingUrl(slug: string): string {
  return `${SITE.url}${href("listingDetail", { params: { slug } })}`;
}

export function listingCategoryHref(listing: ListingDetail): string | null {
  return listing.category ? href("search", { query: { type: "annonces", categorie: listing.category.slug } }) : null;
}

/**
 * Données structurées de l'offre (sans le fil d'Ariane, publié par le
 * composant Breadcrumbs). Rien pour un exemple de démonstration.
 */
export function listingJsonLd(listing: ListingDetail, organizationName: string | null): Record<string, unknown>[] {
  if (listing.verification_status === "placeholder") return [];
  const categoryHref = listingCategoryHref(listing);
  return listingStructuredData(
    {
      title: listing.title,
      description: listing.description,
      url: listingUrl(listing.slug),
      price: listing.price,
      currency: listing.currency,
      publishedAt: listing.published_at,
      expiresAt: listing.expires_at,
      availability: listing.availability_status,
      attributeSchema: listing.category?.attribute_schema ?? null,
      attributes: listing.attributes,
      categoryName: listing.category?.name ?? null,
      categoryUrl: categoryHref ? `${SITE.url}${categoryHref}` : null,
      cityName: listing.city?.name ?? "",
      organizationName,
      imageUrls: [],
    },
    SITE.url,
    `${SITE.url}${href("search", { query: { type: "annonces" } })}`,
  ).slice(1);
}
