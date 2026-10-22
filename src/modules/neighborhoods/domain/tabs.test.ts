import { describe, expect, it } from "vitest";
import { boundaryNotice, NEIGHBORHOOD_NEUTRALITY, NEIGHBORHOOD_TABS, parseTab } from "./tabs";

describe("fiche quartier", () => {
  it("onglet par défaut et valeurs inconnues", () => {
    expect(parseTab(undefined)).toBe("decouvrir");
    expect(parseTab("carte")).toBe("carte");
    expect(parseTab("toString")).toBe("decouvrir");
    expect(Object.keys(NEIGHBORHOOD_TABS)).toEqual(["decouvrir", "logement", "services", "commerces", "tourisme", "carte"]);
  });

  it("avertit quand il n'y a pas de périmètre validé", () => {
    expect(boundaryNotice(false)).toMatch(/Pas de périmètre validé/);
    expect(boundaryNotice(true)).toBeNull();
  });

  it("aucun qualificatif dans les textes affichés", () => {
    const texts = [NEIGHBORHOOD_NEUTRALITY, ...Object.values(NEIGHBORHOOD_TABS).map((tab) => tab.empty), boundaryNotice(false)!].join(" ").toLowerCase();
    // Les mots n'apparaissent que dans la phrase qui les exclut.
    expect(texts.replace(NEIGHBORHOOD_NEUTRALITY.toLowerCase(), "")).not.toMatch(/\b(sûr|calme|meilleur|dangereux|riche|pratique)\b/);
  });
});
