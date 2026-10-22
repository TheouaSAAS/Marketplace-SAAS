import { describe, expect, it } from "vitest";
import { parseRealEstateFilters, realEstateQuery } from "./filters";
import { confirmationFreshness, freshnessLabel } from "./freshness";
import { interpretRealEstate } from "./natural-language";

const neighborhoods = [
  { slug: "bardot", name: "Bardot" },
  { slug: "zone-industrielle", name: "Zone industrielle" },
];

describe("interpretRealEstate", () => {
  it("« je cherche un studio meublé 2 pièces à Bardot moins de 100 000 F »", () => {
    const result = interpretRealEstate("Je cherche un studio meublé 2 pièces à Bardot moins de 100 000 F", "location", neighborhoods);
    expect(result.filters).toEqual({ typeBien: "studio", meuble: true, piecesMin: 2, quartier: "bardot", prixMax: 100_000 });
    expect(result.keywords).toBe("");
    expect(result.understood).toContain("Quartier : Bardot");
  });

  it("« je cherche un logement » ne crée aucun filtre", () => {
    expect(interpretRealEstate("je cherche un logement", "location", neighborhoods)).toEqual({ keywords: "", filters: {}, understood: [] });
  });

  it("ne retient qu'un type de bien adapté à l'entrée", () => {
    expect(interpretRealEstate("terrain à Bardot", "location", neighborhoods).filters.typeBien).toBeUndefined();
    expect(interpretRealEstate("terrain à Bardot", "vente", neighborhoods).filters.typeBien).toBe("terrain");
  });

  it("équipements, non meublé, disponibilité et chambres", () => {
    const result = interpretRealEstate("maison non meublée 3 chambres climatisée avec parking disponible", "location", neighborhoods);
    expect(result.filters).toEqual({
      typeBien: "maison",
      meuble: false,
      chambresMin: 3,
      dispo: true,
      equipements: ["climatisation", "parking"],
    });
  });

  it("un petit nombre sans unité n'est pas un budget", () => {
    expect(interpretRealEstate("budget 50", "location", neighborhoods).filters.prixMax).toBeUndefined();
    expect(interpretRealEstate("max 150k", "location", neighborhoods).filters.prixMax).toBe(150_000);
  });
});

describe("parseRealEstateFilters", () => {
  it("adresse canonique, équipements cochés ou en liste", () => {
    const raw = { type_bien: "studio", pieces: "2", meuble: "oui", equipements: ["parking", "climatisation", "piscine"], tri: "recent" };
    expect(realEstateQuery(parseRealEstateFilters(raw, "location"))).toBe("type_bien=studio&pieces=2&meuble=oui&equipements=climatisation%2Cparking");
  });

  it("ignore ce qui ne convient pas à l'entrée", () => {
    const filters = parseRealEstateFilters({ type_bien: "studio", pieces: "3", meuble: "oui" }, "professionnel");
    expect(filters).toMatchObject({ typeBien: null, piecesMin: null, meuble: null });
  });
});

describe("confirmationFreshness", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  it("signale une annonce non confirmée depuis plus de 30 jours", () => {
    const stale = confirmationFreshness(null, "2026-09-01T00:00:00Z", now);
    expect(stale).toEqual({ status: "stale", days: 51 });
    expect(freshnessLabel(stale, false)).toBe("À reconfirmer : publiée il y a 51 jours");
    expect(freshnessLabel(confirmationFreshness("2026-10-21T12:00:00Z", "2026-09-01T00:00:00Z", now), true)).toBe("Confirmée hier");
  });
});
