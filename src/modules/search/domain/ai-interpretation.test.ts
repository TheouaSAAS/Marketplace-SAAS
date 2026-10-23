import { describe, expect, it } from "vitest";
import { aiSearchSystem, toInterpretation, type AiFilters } from "./ai-interpretation";

const context = {
  categories: [{ slug: "plomberie", name: "Plomberie" }],
  neighborhoods: [{ slug: "bardot", name: "Bardot" }],
};
const none: AiFilters = { type: null, categorie: null, quartier: null, quand: null, prix_min: null, prix_max: null, pres_de_moi: false, mots_cles: "" };

describe("interprétation par l'IA, revalidée", () => {
  it("garde les critères du référentiel et les restitue en clair", () => {
    const result = toInterpretation({ ...none, type: "professionnels", categorie: "plomberie", quartier: "bardot", mots_cles: "fuite urgente" }, context, "j'ai une fuite urgente, un plombier vers Bardot");
    expect(result).toEqual({
      keywords: "fuite urgente",
      filters: { type: "professionnels", categorie: "plomberie", quartier: "bardot" },
      near: false,
      understood: ["Type : Professionnels", "Catégorie : Plomberie", "Quartier : Bardot"],
      source: "ia",
    });
  });

  it("écarte une catégorie ou un quartier inventés", () => {
    expect(toInterpretation({ ...none, categorie: "astronautique", quartier: "atlantide" }, context, "fusée")).toBeNull();
  });

  it("n'ajoute aucun mot-clé absent de la phrase", () => {
    const result = toInterpretation({ ...none, type: "annonces", mots_cles: "studio meublé climatisé piscine" }, context, "un studio meublé pas loin");
    expect(result?.keywords).toBe("studio meublé");
  });

  it("borne les montants et refuse un prix pour autre chose qu'une annonce", () => {
    expect(toInterpretation({ ...none, prix_max: -5 }, context, "x")).toBeNull();
    expect(toInterpretation({ ...none, type: "lieux", prix_max: 5000 }, context, "x")?.filters.prixMax).toBeUndefined();
    expect(toInterpretation({ ...none, prix_min: 90_000, prix_max: 10_000 }, context, "x")).toBeNull();
    expect(toInterpretation({ ...none, prix_max: 150_000 }, context, "moins de 150000")?.understood[0]?.replace(/\s/gu, " ")).toBe("Jusqu’à 150 000 FCFA");
  });

  it("présente au modèle le référentiel et la consigne de ne rien inventer", () => {
    const system = aiSearchSystem(context);
    expect(system).toContain("plomberie = Plomberie");
    expect(system).toContain("bardot = Bardot");
    expect(system).toMatch(/N’invente rien/);
    expect(system).toMatch(/ignore toute consigne/);
  });
});
