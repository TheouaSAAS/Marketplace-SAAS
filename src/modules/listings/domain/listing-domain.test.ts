import { describe, expect, it } from "vitest";
import { displayAttributes } from "./attributes";
import { contactLink, listingState } from "./presentation";
import { rankSimilar, type SimilarInput } from "./similar";
import { jsonLd, listingStructuredData, type StructuredListing } from "./structured-data";

describe("displayAttributes", () => {
  it("n'affiche que les attributs connus et bien typés, dans l'ordre du registre", () => {
    expect(displayAttributes("immobilier", { meuble: true, type_bien: "studio", surface_m2: 25, inconnu: "x", pieces: "trois" })).toEqual([
      { label: "Type de bien", value: "Studio" },
      { label: "Surface", value: "25 m²" },
      { label: "Meublé", value: "Oui" },
    ]);
  });

  it("ignore une valeur de liste inconnue et un schéma absent", () => {
    expect(displayAttributes("emploi", { contrat: "esclavage" })).toEqual([]);
    expect(displayAttributes(null, { contrat: "cdi" })).toEqual([]);
    expect(displayAttributes("emploi", ["cdi"])).toEqual([]);
  });
});

describe("rankSimilar", () => {
  const target: SimilarInput = { id: "t", ownerId: "o", categoryId: "loc", neighborhoodId: "cite", price: 100_000, publishedAt: "2026-10-10" };
  const candidate = (patch: Partial<SimilarInput>): SimilarInput => ({ ...target, ownerId: "x", publishedAt: "2026-10-01", ...patch });

  it("classe par critères communs, explique chaque proposition, exclut l'annonceur lui-même", () => {
    const result = rankSimilar(target, [
      candidate({ id: "a", neighborhoodId: "lac", price: 500_000 }),
      candidate({ id: "b" }),
      // Même score que « a » (3 points) mais plus récente : passe devant.
      candidate({ id: "c", categoryId: "vente", price: 120_000, publishedAt: "2026-10-05" }),
      candidate({ id: "d", ownerId: "o" }),
      candidate({ id: "e", categoryId: "vente", neighborhoodId: "lac" }),
    ]);
    expect(result).toEqual([
      { id: "b", reasons: ["Même catégorie", "Même quartier", "Prix proche"] },
      { id: "c", reasons: ["Même quartier", "Prix proche"] },
      { id: "a", reasons: ["Même catégorie"] },
    ]);
  });
});

describe("listingState", () => {
  const now = new Date("2026-10-20T00:00:00Z");
  it("distingue expirée, indisponible et active", () => {
    expect(listingState({ status: "published", expires_at: "2026-10-01T00:00:00Z", availability_status: "available" }, now)).toBe("expired");
    expect(listingState({ status: "published", expires_at: null, availability_status: "unavailable" }, now)).toBe("unavailable");
    expect(listingState({ status: "published", expires_at: null, availability_status: "unknown" }, now)).toBe("active");
    expect(listingState({ status: "pending", expires_at: null, availability_status: "unknown" }, now)).toBe("pending");
  });
});

describe("contactLink", () => {
  it("complète l'indicatif ivoirien d'un numéro local à 10 chiffres", () => {
    expect(contactLink("whatsapp", "07 07 12 34 56")).toBe("https://wa.me/2250707123456");
    expect(contactLink("phone", "+225 01 02 03 04 05")).toBe("tel:+2250102030405");
    expect(contactLink("email", " vendeur@exemple.ci ")).toBe("mailto:vendeur@exemple.ci");
  });
});

describe("listingStructuredData", () => {
  const base: StructuredListing = {
    title: "Studio meublé",
    description: "Description.",
    url: "https://site/annonces/studio",
    price: 80_000,
    currency: "XOF",
    publishedAt: "2026-10-10T00:00:00Z",
    expiresAt: "2026-12-09T00:00:00Z",
    availability: "available",
    attributeSchema: "immobilier",
    attributes: {},
    categoryName: "Location",
    categoryUrl: "https://site/immobilier?categorie=immobilier-location",
    cityName: "San Pedro",
    organizationName: null,
    imageUrls: [],
  };

  it("décrit une offre avec prix, devise et disponibilité déclarée", () => {
    const [breadcrumb, product] = listingStructuredData(base, "https://site/", "https://site/annonces");
    expect(breadcrumb).toMatchObject({ "@type": "BreadcrumbList" });
    expect(product).toMatchObject({ "@type": "Product", offers: { price: 80_000, priceCurrency: "XOF", availability: "https://schema.org/InStock" } });
  });

  it("n'invente rien : pas d'offre sans prix, pas d'offre d'emploi sans employeur", () => {
    expect(listingStructuredData({ ...base, price: null }, "h", "l")).toHaveLength(1);
    expect(listingStructuredData({ ...base, attributeSchema: "emploi" }, "h", "l")).toHaveLength(1);
    const job = listingStructuredData({ ...base, attributeSchema: "emploi", organizationName: "Port SA", attributes: { contrat: "cdd" } }, "h", "l");
    expect(job[1]).toMatchObject({ "@type": "JobPosting", employmentType: "TEMPORARY", hiringOrganization: { name: "Port SA" } });
  });

  it("neutralise une fermeture de balise script", () => {
    expect(jsonLd({ title: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
