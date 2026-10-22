import { describe, expect, it } from "vitest";
import { categoryForest, parseKeywords, slugify, type AdminCategory } from "./categories";

const category = (id: string, name: string, parent: string | null, sort = 0): AdminCategory => ({
  id,
  parent_id: parent,
  family: "entreprendre",
  slug: slugify(name),
  name,
  sort_order: sort,
  is_active: true,
  keywords: [],
});

describe("référentiel des catégories", () => {
  it("nettoie les mots-clés saisis", () => {
    expect(parseKeywords(" Clim, climatiseur\nCLIM ;  panne   de courant ,, ")).toEqual(["clim", "climatiseur", "panne de courant"]);
    expect(parseKeywords("x".repeat(61))).toEqual([]);
  });

  it("dérive un identifiant d'adresse du nom", () => {
    expect(slugify("Fruits & légumes")).toBe("fruits-legumes");
    expect(slugify("  Électricité générale ")).toBe("electricite-generale");
    expect(slugify("!!!")).toBe("");
  });

  it("aplatit l'arbre par famille, parents avant enfants, dans l'ordre", () => {
    const forest = categoryForest([
      category("c", "Climatisation", "a", 30),
      category("a", "Artisans", null, 10),
      category("b", "Plomberie", "a", 10),
      { ...category("d", "Restaurants", null, 5), family: "decouvrir" },
    ]);
    expect(forest.map((group) => group.family)).toEqual(["decouvrir", "entreprendre"]);
    expect(forest[1]?.nodes.map((node) => [node.category.name, node.depth])).toEqual([
      ["Artisans", 0],
      ["Plomberie", 1],
      ["Climatisation", 1],
    ]);
  });
});
