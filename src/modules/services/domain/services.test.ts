import { describe, expect, it } from "vitest";
import { interpretNeed, type Trade } from "./need";
import { parseServiceFilters, serviceQuery } from "./params";
import { isQuoteStatus, quoteDetails } from "./quote";

const trades: Trade[] = [
  { slug: "climatisation", name: "Climatisation et froid", keywords: ["climatisation", "clim", "climatiseur"] },
  { slug: "electricite", name: "Électricité", keywords: ["electricien", "panne de courant", "prise"] },
  { slug: "plomberie", name: "Plomberie", keywords: ["plombier", "fuite", "chauffe-eau"] },
];

describe("interpretNeed", () => {
  it("« ma climatisation ne fonctionne plus » → climatisation", () => {
    expect(interpretNeed("Ma climatisation ne fonctionne plus", trades)).toMatchObject({ trade: { slug: "climatisation" }, matched: "climatisation", urgent: false });
  });

  it("insensible aux accents et à la casse, mot-clé le plus long", () => {
    expect(interpretNeed("PANNE DE COURANT dans la maison", trades).trade?.slug).toBe("electricite");
    expect(interpretNeed("mon chauffe eau fuit", trades).trade?.slug).toBe("plomberie");
  });

  it("aucun métier deviné sans mot-clé, urgence repérée mais jamais promise", () => {
    expect(interpretNeed("j'ai besoin d'aide urgent", trades)).toEqual({ trade: null, matched: null, urgent: true });
  });

  it("un mot-clé doit être un mot entier (« prise » ≠ « surprise »)", () => {
    expect(interpretNeed("une surprise", trades).trade).toBeNull();
  });
});

describe("parseServiceFilters", () => {
  it("lit et réécrit une adresse canonique, ignore l'invalide", () => {
    const filters = parseServiceFilters({ metier: "plomberie", contact: "devis", dispo: "1", rayon: "500", page: "2", tri: "hasard" });
    expect(serviceQuery(filters)).toBe("metier=plomberie&dispo=1&contact=devis&page=2");
  });
});

describe("demandes de devis", () => {
  it("lit les détails structurés et ignore les valeurs inconnues", () => {
    expect(quoteDetails({ prestation: " Réparation ", quand: "semaine", quartier: "" })).toEqual({ prestation: "Réparation", quand: "Dans la semaine", quartier: null });
    expect(quoteDetails({ prestation: 42, quand: "hier" })).toEqual({ prestation: null, quand: null, quartier: null });
  });

  it("reconnaît les statuts de suivi", () => {
    expect(isQuoteStatus("replied")).toBe(true);
    expect(isQuoteStatus("toString")).toBe(false);
    expect(isQuoteStatus(undefined)).toBe(false);
  });
});
