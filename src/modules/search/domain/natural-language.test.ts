import { describe, expect, it } from "vitest";
import { interpretQuery, type InterpretationContext } from "./natural-language";

const context: InterpretationContext = {
  neighborhoods: [
    { slug: "bardot", name: "Bardot" },
    { slug: "zone-industrielle", name: "Zone industrielle" },
    { slug: "lac", name: "Lac" },
  ],
  categorySlugs: new Set(["immobilier-location", "immobilier-vente", "terrains", "emploi-stages", "stages"]),
};

const interpret = (text: string) => interpretQuery(text, context);

describe("interpretQuery", () => {
  it("« studio à louer près de moi » : annonce immobilière en location, près de soi, mot-clé studio", () => {
    const result = interpret("studio à louer près de moi");
    expect(result.keywords).toBe("studio");
    expect(result.filters).toEqual({ type: "annonces", categorie: "immobilier-location" });
    expect(result.near).toBe(true);
    expect(result.understood).toEqual(["Annonces immobilières à louer", "Près de vous"]);
  });

  it("« électricien » reste un simple mot-clé (aucune catégorie inventée)", () => {
    const result = interpret("électricien");
    expect(result).toEqual({ keywords: "électricien", filters: {}, near: false, understood: [] });
  });

  it("retire les mots de liaison sans rien interpréter", () => {
    expect(interpret("Je cherche un électricien").keywords).toBe("électricien");
  });

  it("« activité ce week-end » : événements du week-end, sans mot-clé restant", () => {
    const result = interpret("activité ce week-end");
    expect(result.filters).toEqual({ type: "evenements", quand: "weekend" });
    expect(result.keywords).toBe("");
    expect(result.understood).toEqual(["Événements · ce week-end"]);
  });

  it("une période ne transforme pas une annonce en événement", () => {
    const result = interpret("voiture à louer ce week-end");
    expect(result.filters.type).toBe("annonces");
    expect(result.filters.quand).toBeUndefined();
    // Sans mot de logement, aucune catégorie immobilière n'est supposée.
    expect(result.filters.categorie).toBeUndefined();
    expect(result.keywords).toBe("voiture ce week end");
  });

  it("reconnaît un prix maximal explicite, avec ou sans espaces", () => {
    expect(interpret("chambre à louer moins de 50 000 F").filters).toMatchObject({ prixMax: 50_000, categorie: "immobilier-location" });
    expect(interpret("maison à vendre max 25 millions").filters.prixMax).toBeUndefined();
    expect(interpret("moto max 300k").filters).toMatchObject({ type: "annonces", prixMax: 300_000 });
    expect(interpret("budget 150000").filters.prixMax).toBe(150_000);
  });

  it("n'interprète pas un petit nombre sans unité comme un prix", () => {
    const result = interpret("appartement moins de 3 pièces");
    expect(result.filters.prixMax).toBeUndefined();
    expect(result.keywords).toContain("3");
  });

  it("reconnaît un quartier existant précédé d'une préposition, jamais un mot isolé", () => {
    expect(interpret("restaurant à Bardot").filters.quartier).toBe("bardot");
    expect(interpret("bureau zone industrielle").filters.quartier).toBeUndefined();
    expect(interpret("bureau dans le quartier zone industrielle").filters.quartier).toBe("zone-industrielle");
    expect(interpret("vue sur le lac").filters.quartier).toBeUndefined();
  });

  it("vente de terrain et emploi", () => {
    expect(interpret("terrain à vendre").filters).toEqual({ type: "annonces", categorie: "terrains" });
    expect(interpret("offre d'emploi comptable").filters).toEqual({ type: "annonces", categorie: "emploi-stages" });
    expect(interpret("offre d'emploi comptable").keywords).toBe("comptable");
  });

  it("une catégorie absente du référentiel n'est jamais appliquée", () => {
    const result = interpretQuery("stage informatique", { neighborhoods: [], categorySlugs: new Set() });
    expect(result.filters).toEqual({});
    expect(result.keywords).toBe("stage informatique");
  });

  it("« pas cher » trie par prix croissant, uniquement pour des annonces", () => {
    expect(interpret("frigo pas cher").filters).toEqual({ type: "annonces", tri: "prix_asc" });
    const concert = interpret("concert pas cher ce soir");
    expect(concert.filters).toEqual({ type: "evenements", quand: "aujourdhui" });
    expect(concert.keywords).toBe("concert pas cher");
  });
});
