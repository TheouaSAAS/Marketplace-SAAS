// @vitest-environment node
import { describe, expect, it } from "vitest";
import { categoryIdsWithDescendants, selectCategoryTree, type Category } from "./categories";

const category = (id: string, slug: string, parent: string | null = null): Category => ({
  id,
  slug,
  name: slug,
  parent_id: parent,
  icon: null,
  sort_order: 0,
  content_types: [],
});

const all = [
  category("00000000-0000-4000-8000-000000000001", "immobilier"),
  category("00000000-0000-4000-8000-000000000002", "immobilier-location", "00000000-0000-4000-8000-000000000001"),
  category("00000000-0000-4000-8000-000000000003", "colocation", "00000000-0000-4000-8000-000000000002"),
  category("00000000-0000-4000-8000-000000000004", "vehicules"),
];

describe("categoryIdsWithDescendants", () => {
  it("inclut toutes les sous-catégories, à toute profondeur", () => {
    expect(categoryIdsWithDescendants(all, ["immobilier"]).sort()).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    ]);
  });

  it("n'inclut pas les catégories voisines et ignore les slugs inconnus", () => {
    expect(categoryIdsWithDescendants(all, ["immobilier-location", "inconnue"]).sort()).toEqual([
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    ]);
    expect(categoryIdsWithDescendants(all, ["inconnue"])).toEqual([]);
  });
});

describe("selectCategoryTree", () => {
  it("présente une catégorie et ses enfants directs, dans l'ordre demandé", () => {
    const tree = selectCategoryTree(all, ["vehicules", "immobilier"]);
    expect(tree.map(({ parent }) => parent.slug)).toEqual(["vehicules", "immobilier"]);
    expect(tree[1]?.children.map((child) => child.slug)).toEqual(["immobilier-location"]);
  });
});
