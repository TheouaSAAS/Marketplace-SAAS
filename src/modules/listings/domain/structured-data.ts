/**
 * Données structurées (schema.org, JSON-LD) d'une annonce publique.
 * Uniquement des informations publiées par l'annonceur, jamais complétées :
 * une offre d'emploi sans employeur nommé n'est pas décrite comme JobPosting,
 * une annonce sans prix n'a pas d'Offer. Jamais pour un exemple de
 * démonstration (la page n'est alors pas indexée).
 */

export interface StructuredListing {
  title: string;
  description: string;
  url: string;
  price: number | null;
  currency: string;
  publishedAt: string | null;
  expiresAt: string | null;
  availability: "available" | "reserved" | "unavailable" | "unknown";
  attributeSchema: string | null;
  attributes: Record<string, unknown>;
  categoryName: string | null;
  categoryUrl: string | null;
  cityName: string;
  organizationName: string | null;
  imageUrls: string[];
}

const AVAILABILITY: Record<StructuredListing["availability"], string | null> = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/LimitedAvailability",
  unavailable: "https://schema.org/SoldOut",
  unknown: null,
};

const EMPLOYMENT: Record<string, string> = {
  cdi: "FULL_TIME",
  cdd: "TEMPORARY",
  stage: "INTERN",
  interim: "TEMPORARY",
  freelance: "CONTRACTOR",
  temps_partiel: "PART_TIME",
};

export function listingStructuredData(listing: StructuredListing, home: string, listingsUrl: string): Record<string, unknown>[] {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Accueil", item: home },
      { name: "Annonces", item: listingsUrl },
      ...(listing.categoryName && listing.categoryUrl ? [{ name: listing.categoryName, item: listing.categoryUrl }] : []),
      { name: listing.title, item: listing.url },
    ].map((entry, index) => ({ "@type": "ListItem", position: index + 1, ...entry })),
  };

  const description = listing.description.slice(0, 5000);
  const place = { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: listing.cityName, addressCountry: "CI" } };

  if (listing.attributeSchema === "emploi") {
    if (!listing.organizationName || !listing.publishedAt) return [breadcrumb];
    const contract = typeof listing.attributes.contrat === "string" ? EMPLOYMENT[listing.attributes.contrat] : undefined;
    return [
      breadcrumb,
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: listing.title,
        description,
        datePosted: listing.publishedAt,
        ...(listing.expiresAt ? { validThrough: listing.expiresAt } : {}),
        ...(contract ? { employmentType: contract } : {}),
        hiringOrganization: { "@type": "Organization", name: listing.organizationName },
        jobLocation: place,
        url: listing.url,
      },
    ];
  }

  if (listing.price === null) return [breadcrumb];
  const availability = AVAILABILITY[listing.availability];
  return [
    breadcrumb,
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: listing.title,
      description,
      url: listing.url,
      ...(listing.imageUrls.length ? { image: listing.imageUrls } : {}),
      ...(listing.categoryName ? { category: listing.categoryName } : {}),
      offers: {
        "@type": "Offer",
        price: listing.price,
        priceCurrency: listing.currency,
        url: listing.url,
        ...(availability ? { availability } : {}),
        ...(listing.expiresAt ? { priceValidUntil: listing.expiresAt.slice(0, 10) } : {}),
        availableAtOrFrom: place,
        ...(listing.organizationName ? { seller: { "@type": "Organization", name: listing.organizationName } } : {}),
      },
    },
  ];
}

/** Sérialisation sûre dans une balise <script> (aucune fermeture de balise possible). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
