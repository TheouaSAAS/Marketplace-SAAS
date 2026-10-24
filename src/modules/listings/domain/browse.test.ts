import { describe, expect, it } from "vitest";
import { activeDefinitions, categoryFilters } from "./attributes";
import { appliedAttributes, attributeCriteria, browseQuery, parseBrowseParams } from "./browse";

describe("paramètres de « Toutes les annonces »", () => {
  it("revalide chaque paramètre et ignore les valeurs invalides", () => {
    const params = parseBrowseParams({ q: "  frigo   samsung ", categorie: "electromenager", ville: "San Pedro!", prix_max: "150 000", tri: "pirate", page: "3", etat: "bon" });
    expect(params).toMatchObject({ q: "frigo samsung", categorie: "electromenager", ville: null, prixMax: 150000, tri: null, page: 3, attributes: { etat: "bon" } });
  });

  it("construit une adresse canonique stable, sans tri ni page par défaut", () => {
    const params = parseBrowseParams({ tri: "recent", page: "1", marque: "Toyota", annee_min: "2015", categorie: "voitures" });
    expect(browseQuery(params)).toBe("categorie=voitures&annee_min=2015&marque=Toyota");
    expect(browseQuery(params, { page: 2, tri: "prix_asc" })).toBe("categorie=voitures&annee_min=2015&marque=Toyota&tri=prix_asc&page=2");
  });
});

describe("filtres de caractéristiques", () => {
  it("ne retient que les filtres de la catégorie et les valeurs du référentiel", () => {
    const filters = categoryFilters("vehicule", null);
    const criteria = attributeCriteria({ carburant: "diesel", etat: "inventé", marque: "Toyota", annee_min: "2015", kilometrage_max: "120 000", meuble: "1" }, filters);
    expect(criteria).toEqual({ eq: { carburant: "diesel" }, text: { marque: "Toyota" }, min: { annee: 2015 }, max: { kilometrage: 120000 } });
    expect(appliedAttributes(criteria)).toEqual({ carburant: "diesel", marque: "Toyota", annee_min: "2015", kilometrage_max: "120000" });
  });

  it("n'impose pas les champs d'un véhicule complet aux pièces", () => {
    const keys = categoryFilters("piece", null).map(([key]) => key);
    expect(keys).toEqual(["type_piece", "etat", "marque"]);
    expect(keys).not.toContain("kilometrage");
  });

  it("respecte les champs activés par l'administration pour une catégorie", () => {
    expect(activeDefinitions("vehicule", ["marque", "etat"]).map(([key]) => key)).toEqual(["marque", "etat"]);
    expect(categoryFilters("vehicule", ["marque", "modele"]).map(([key]) => key)).toEqual(["marque"]);
    expect(categoryFilters(null, null)).toEqual([]);
  });

  it("propose l'état demandé pour les biens : neuf, très bon, bon, correct, à réparer", () => {
    const etat = categoryFilters("bien", null).find(([key]) => key === "etat")?.[1].type;
    expect(etat?.kind === "choice" && Object.values(etat.options)).toEqual(["Neuf", "Très bon état", "Bon état", "État correct", "À réparer"]);
  });
});
