import { describe, expect, it } from "vitest";
import { SITE } from "@/config/site";
import { detailMetadata, eventJsonLd, listMetadata, localJsonLd, serializeJsonLd, type StructuredEvent } from "./seo";

describe("pages de liste", () => {
  it("garde la rubrique et la page dans l'adresse canonique, sans noindex", () => {
    const meta = listMetadata({ title: "Immobilier", description: "d", path: "/immobilier", searchParams: { page: "2", categorie: "location" }, keep: ["categorie"] });
    expect(meta.alternates?.canonical).toBe(`${SITE.url}/immobilier?categorie=location&page=2`);
    expect(meta.robots).toBeUndefined();
  });

  it("n'indexe pas les variantes filtrées ou triées", () => {
    const meta = listMetadata({ title: "Immobilier", description: "d", path: "/immobilier", searchParams: { categorie: "location", prixMax: "100000", tri: "prix_asc" }, keep: ["categorie"] });
    expect(meta.alternates?.canonical).toBe(`${SITE.url}/immobilier?categorie=location`);
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("traite la première page comme la page de base", () => {
    expect(listMetadata({ title: "t", description: "d", path: "/emploi", searchParams: { page: "1" } }).alternates?.canonical).toBe(`${SITE.url}/emploi`);
  });
});

describe("fiches", () => {
  it("donne canonique, partage social et noindex pour un exemple", () => {
    const meta = detailMetadata({ title: "Maquis", description: "  Un   maquis\nanimé ", path: "/lieux/maquis", noindex: true });
    expect(meta.alternates?.canonical).toBe(`${SITE.url}/lieux/maquis`);
    expect(meta.description).toBe("Un maquis animé");
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.openGraph).toMatchObject({ url: `${SITE.url}/lieux/maquis`, siteName: SITE.name });
  });
});

const event: StructuredEvent = {
  title: "Fête du port",
  description: "Concerts.",
  path: "/evenements/fete-du-port",
  startsAt: "2026-12-01T18:00:00Z",
  endsAt: null,
  schedule: "postponed",
  originalStartsAt: "2026-11-20T18:00:00Z",
  isFree: true,
  priceMin: null,
  ticketUrl: null,
  organizerName: "Mairie",
  placeName: null,
  address: null,
  neighborhood: "Bardot",
  city: "San Pedro",
  verified: true,
};

describe("données structurées", () => {
  it("décrit un événement vérifié, report compris, sans champ vide", () => {
    const data = eventJsonLd(event)!;
    expect(data["@type"]).toBe("Event");
    expect(data.eventStatus).toBe("https://schema.org/EventRescheduled");
    expect(data.previousStartDate).toBe("2026-11-20T18:00:00Z");
    expect(data).not.toHaveProperty("endDate");
    expect(data.offers).toMatchObject({ price: 0, priceCurrency: "XOF" });
    expect(data.location).toMatchObject({ address: { addressLocality: "Bardot, San Pedro", addressCountry: "CI" } });
  });

  it("ne publie rien pour un contenu non vérifié", () => {
    expect(eventJsonLd({ ...event, verified: false })).toBeNull();
    expect(localJsonLd({ name: "x", description: null, path: "/lieux/x", address: null, neighborhood: null, city: "San Pedro", telephone: null, website: null, categoryName: null, verified: false })).toBeNull();
  });

  it("n'accepte qu'un site https comme lien officiel", () => {
    const data = localJsonLd({ name: "Maquis", description: null, path: "/lieux/maquis", address: "Rue 1", neighborhood: null, city: "San Pedro", telephone: "0700", website: "http://exemple.ci", categoryName: "Restaurants", verified: true })!;
    expect(data).not.toHaveProperty("sameAs");
    expect(data.telephone).toBe("0700");
  });

  it("ne laisse jamais fermer la balise script", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toMatch(/<|>/);
  });
});
