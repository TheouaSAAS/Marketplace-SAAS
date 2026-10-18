import { describe, expect, it } from "vitest";
import { whenRange } from "./dates";
import { activeFilters, effectiveSort, forType, parseSearchParams, rawQueryString, toQueryString, withChanges } from "./params";

describe("parseSearchParams", () => {
  it("lit une recherche complète et la réécrit à l'identique", () => {
    const query = "q=studio&type=annonces&categorie=immobilier-location&quartier=bardot&verifie=1&prix_min=10000&prix_max=80000&dispo=1&annonceur=particulier&rayon=5&tri=prix_asc&page=2";
    const params = parseSearchParams(Object.fromEntries(new URLSearchParams(query)));
    expect(toQueryString(params)).toBe(query);
  });

  it("ignore les valeurs invalides au lieu d'échouer", () => {
    const params = parseSearchParams({ type: "inconnu", categorie: "../x", prix_max: "abc", tri: "hasard", page: "-3", rayon: "500" });
    expect(params).toMatchObject({ type: null, categorie: null, prixMax: null, tri: null, page: 1, rayon: null });
  });

  it("retire les filtres qui ne s'appliquent pas au type affiché", () => {
    const params = parseSearchParams({ type: "lieux", prix_max: "5000", quand: "weekend", annonceur: "professionnel", tri: "prix_asc", categorie: "restaurants" });
    expect(params).toMatchObject({ prixMax: null, quand: null, annonceur: null, tri: null, categorie: "restaurants" });
    expect(parseSearchParams({ type: "guide", quartier: "bardot", rayon: "5" })).toMatchObject({ quartier: null, rayon: null });
    // Aperçu : pas de pagination ni de filtre propre à un type.
    expect(parseSearchParams({ page: "3", categorie: "x" })).toMatchObject({ page: 1, categorie: null });
  });

  it("remet un intervalle de prix inversé dans l'ordre", () => {
    expect(parseSearchParams({ type: "annonces", prix_min: "90 000", prix_max: "10000" })).toMatchObject({ prixMin: 10_000, prixMax: 90_000 });
  });

  it("n'écrit pas le tri par défaut : une seule adresse par recherche", () => {
    expect(toQueryString(parseSearchParams({ type: "annonces", tri: "recent" }))).toBe("type=annonces");
    expect(toQueryString(parseSearchParams({ q: "studio", type: "annonces", tri: "pertinence" }))).toBe("q=studio&type=annonces");
    expect(toQueryString(parseSearchParams({ q: "studio", type: "annonces", tri: "recent" }))).toBe("q=studio&type=annonces&tri=recent");
  });

  it("détecte une adresse non canonique (champs vides, ordre, inconnus)", () => {
    const raw = { type: "annonces", categorie: "", verifie: "1", utm: "x" };
    expect(rawQueryString(raw)).toBe("type=annonces&categorie=&verifie=1&utm=x");
    expect(toQueryString(parseSearchParams(raw))).toBe("type=annonces&verifie=1");
  });

  it("borne la longueur du texte et normalise les espaces", () => {
    expect(parseSearchParams({ q: `  studio   ${"x".repeat(300)}` }).q).toHaveLength(120);
  });
});

describe("navigation entre recherches", () => {
  const base = parseSearchParams({ q: "studio", type: "annonces", quartier: "bardot", prix_max: "50000", page: "3", tri: "recent" });

  it("tout changement de filtre revient à la page 1", () => {
    expect(withChanges(base, { verifie: true }).page).toBe(1);
    expect(withChanges(base, { page: 4 }).page).toBe(4);
  });

  it("changer d'onglet conserve le texte et les critères communs seulement", () => {
    expect(toQueryString(forType(base, "evenements"))).toBe("q=studio&type=evenements&quartier=bardot");
    expect(toQueryString(forType(base, null))).toBe("q=studio&quartier=bardot");
  });

  it("chaque filtre actif se retire individuellement", () => {
    const filters = activeFilters(base, { neighborhood: "Bardot" });
    // Le séparateur des milliers français est une espace insécable fine.
    expect(filters.map((filter) => filter.label.replace(/\s/g, " "))).toEqual(["Quartier : Bardot", "Jusqu’à 50 000 FCFA"]);
    expect(toQueryString(filters[1]!.without)).toBe("q=studio&type=annonces&quartier=bardot&tri=recent");
  });

  it("le tri par distance exige une position ; le tri par défaut dépend du texte et du type", () => {
    expect(effectiveSort(withChanges(base, { tri: "proximite" }), "annonces", false)).toBe("pertinence");
    expect(effectiveSort(withChanges(base, { tri: "proximite" }), "annonces", true)).toBe("proximite");
    expect(effectiveSort(parseSearchParams({ type: "evenements" }), "evenements", false)).toBe("date");
    expect(effectiveSort(parseSearchParams({ type: "annonces" }), "annonces", false)).toBe("recent");
  });
});

describe("whenRange", () => {
  // Mercredi 21 octobre 2026, 15 h (heure de San Pedro = UTC).
  const wednesday = new Date("2026-10-21T15:00:00Z");

  it("week-end : du samedi 0 h au lundi 0 h", () => {
    expect(whenRange("weekend", wednesday)).toEqual({ from: new Date("2026-10-24T00:00:00Z"), to: new Date("2026-10-26T00:00:00Z") });
  });

  it("un week-end en cours commence maintenant", () => {
    const sunday = new Date("2026-10-25T10:00:00Z");
    expect(whenRange("weekend", sunday)).toEqual({ from: sunday, to: new Date("2026-10-26T00:00:00Z") });
  });

  it("aujourd'hui et demain", () => {
    expect(whenRange("aujourdhui", wednesday)).toEqual({ from: wednesday, to: new Date("2026-10-22T00:00:00Z") });
    expect(whenRange("demain", wednesday)).toEqual({ from: new Date("2026-10-22T00:00:00Z"), to: new Date("2026-10-23T00:00:00Z") });
  });
});
