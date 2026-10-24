import type { Metadata } from "next";
import { SITE } from "@/config/site";

/**
 * Référencement (niveau 25) : une adresse canonique par contenu, aucune
 * indexation des exemples, des pages filtrées ni des contenus faibles, des
 * données structurées seulement quand l'information est vérifiée.
 */

export const absoluteUrl = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;

type Raw = Record<string, string | string[] | undefined>;

/**
 * Pages de rubrique et pages d'information : seuls les paramètres « de
 * contenu » (rubrique, catégorie, page) forment une adresse indexable ; tri,
 * prix, texte, distance… créent des variantes sans valeur propre (canonique
 * vers la version sans eux, noindex, liens suivis). Sans paramètre
 * (`searchParams: {}`), donne la canonique et le partage social d'une page fixe.
 */
export function listMetadata({ title, description, path, searchParams, keep = [] }: { title: string; description: string; path: string; searchParams: Raw; keep?: readonly string[] }): Metadata {
  const kept = new URLSearchParams();
  let extra = false;
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === "") continue;
    const first = Array.isArray(value) ? value[0] : value;
    if ((keep.includes(key) || key === "page") && first && !Array.isArray(value) && !(key === "page" && first === "1")) kept.set(key, first);
    else extra = true;
  }
  kept.sort();
  const query = kept.toString();
  const url = absoluteUrl(query ? `${path}?${query}` : path);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: extra ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url, type: "website", locale: SITE.locale, siteName: SITE.name },
  };
}

/** Fiche de contenu : canonique, partage social, jamais indexée si c'est un exemple ou si l'auteur l'a refusé. */
export function detailMetadata({
  title,
  description,
  path,
  noindex,
  type = "website",
}: {
  title: string;
  description: string | null;
  path: string;
  noindex: boolean;
  type?: "website" | "article";
}): Metadata {
  const url = absoluteUrl(path);
  const text = (description ?? "").replace(/\s+/g, " ").trim().slice(0, 160) || undefined;
  return {
    title,
    description: text,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description: text, url, type, locale: SITE.locale, siteName: SITE.name },
    twitter: { card: "summary_large_image", title, description: text },
  };
}

// -----------------------------------------------------------------------------
// Données structurées (schema.org) : uniquement pour un contenu VÉRIFIÉ.
// -----------------------------------------------------------------------------
const clean = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== "" && !(Array.isArray(item) && item.length === 0))
      .map(([key, item]) => [key, item && typeof item === "object" && !Array.isArray(item) ? clean(item as Record<string, unknown>) : item]),
  );

const postalAddress = (street: string | null, neighborhood: string | null, city: string) =>
  clean({ "@type": "PostalAddress", streetAddress: street, addressLocality: neighborhood ? `${neighborhood}, ${city}` : city, addressCountry: "CI" });

export interface StructuredEvent {
  title: string;
  description: string;
  path: string;
  startsAt: string;
  endsAt: string | null;
  schedule: "scheduled" | "postponed" | "cancelled";
  originalStartsAt: string | null;
  isFree: boolean;
  priceMin: number | null;
  ticketUrl: string | null;
  organizerName: string | null;
  placeName: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string;
  verified: boolean;
}

const EVENT_STATUS = { scheduled: "https://schema.org/EventScheduled", postponed: "https://schema.org/EventRescheduled", cancelled: "https://schema.org/EventCancelled" } as const;

export function eventJsonLd(event: StructuredEvent): Record<string, unknown> | null {
  if (!event.verified) return null;
  return clean({
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description.slice(0, 500),
    url: absoluteUrl(event.path),
    startDate: event.startsAt,
    endDate: event.endsAt,
    previousStartDate: event.schedule === "postponed" ? event.originalStartsAt : null,
    eventStatus: EVENT_STATUS[event.schedule],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    isAccessibleForFree: event.isFree,
    location: clean({ "@type": "Place", name: event.placeName ?? event.address ?? event.city, address: postalAddress(event.address, event.neighborhood, event.city) }),
    organizer: event.organizerName ? { "@type": "Organization", name: event.organizerName } : null,
    offers: event.isFree
      ? { "@type": "Offer", price: 0, priceCurrency: "XOF", url: event.ticketUrl ?? absoluteUrl(event.path) }
      : event.priceMin !== null
        ? { "@type": "Offer", price: event.priceMin, priceCurrency: "XOF", url: event.ticketUrl ?? absoluteUrl(event.path) }
        : null,
  });
}

export interface StructuredLocal {
  name: string;
  description: string | null;
  path: string;
  /** Adresse publique seulement (jamais l'adresse privée d'un professionnel). */
  address: string | null;
  neighborhood: string | null;
  city: string;
  telephone: string | null;
  website: string | null;
  categoryName: string | null;
  verified: boolean;
}

/** Lieu ou professionnel vérifié : LocalBusiness (TouristAttraction pour un site à visiter). */
export function localJsonLd(local: StructuredLocal, type: "LocalBusiness" | "TouristAttraction" = "LocalBusiness"): Record<string, unknown> | null {
  if (!local.verified) return null;
  return clean({
    "@context": "https://schema.org",
    "@type": type,
    name: local.name,
    description: local.description?.slice(0, 500),
    url: absoluteUrl(local.path),
    address: postalAddress(local.address, local.neighborhood, local.city),
    telephone: local.telephone,
    sameAs: local.website && /^https:\/\//.test(local.website) ? [local.website] : null,
    knowsAbout: type === "LocalBusiness" ? local.categoryName : null,
  });
}

/** Sérialisation sûre dans une balise script (aucune fermeture possible). */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
