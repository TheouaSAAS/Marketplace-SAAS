import { describe, expect, it } from "vitest";
import { resolveSearch } from "./effective";
import { interpretQuery } from "./natural-language";
import { parseSearchParams, toQueryString } from "./params";

const context = { neighborhoods: [{ slug: "bardot", name: "Bardot" }], categorySlugs: new Set(["immobilier-location"]) };
const run = (query: string, hasPosition = false) => {
  const params = parseSearchParams(Object.fromEntries(new URLSearchParams(query)));
  return resolveSearch(params, params.q ? interpretQuery(params.q, context) : null, hasPosition);
};

describe("resolveSearch", () => {
  it("une saisie libre devient une recherche structurée explicite", () => {
    const { params, interpretation } = run("q=studio à louer à Bardot");
    expect(toQueryString(params)).toBe("q=studio&type=annonces&categorie=immobilier-location&quartier=bardot");
    expect(interpretation?.understood).toEqual(["Annonces immobilières à louer", "Quartier : Bardot"]);
  });

  it("« près de moi » trie par distance seulement si la position est autorisée", () => {
    expect(run("q=studio à louer près de moi", true).params.tri).toBe("proximite");
    expect(run("q=studio à louer près de moi", false).params.tri).toBeNull();
  });

  it("n'interprète pas une recherche déjà structurée ni une demande de texte exact", () => {
    expect(run("q=studio à louer&verifie=1").interpretation).toBeNull();
    expect(run("q=studio à louer&brut=1").params.q).toBe("studio à louer");
  });

  it("un onglet choisi qui contredit la phrase l'emporte : texte recherché tel quel", () => {
    const { params, interpretation } = run("q=studio à louer&type=lieux");
    expect(interpretation).toBeNull();
    expect(params).toMatchObject({ q: "studio à louer", type: "lieux", categorie: null });
  });

  it("une recherche sans rien à interpréter reste inchangée", () => {
    const { params, interpretation } = run("q=électricien");
    expect(interpretation).toBeNull();
    expect(params.q).toBe("électricien");
  });
});
