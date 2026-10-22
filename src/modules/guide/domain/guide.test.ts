import { describe, expect, it } from "vitest";
import { anchorId, parseInline, parseMarkdown, readingMinutes, safeHref, tableOfContents } from "./markdown";
import { resourceHref } from "./resources";
import { articleTrust } from "./trust";

describe("markdown restreint du guide", () => {
  const source = [
    "## Se soigner la nuit",
    "Un paragraphe avec **gras** et *italique*,",
    "sur deux lignes.",
    "",
    "- premier point",
    "- second [point](/services?metier=sante)",
    "",
    "1. étape une",
    "2. étape deux",
    "",
    "> Appelez avant de vous déplacer.",
    "",
    "### Détail",
    "## Se soigner la nuit",
  ].join("\n");
  const blocks = parseMarkdown(source);

  it("reconnaît titres, paragraphes, listes et encadrés", () => {
    expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "list", "list", "notice", "heading", "heading"]);
    expect(blocks[2]).toMatchObject({ kind: "list", ordered: false });
    expect(blocks[3]).toMatchObject({ kind: "list", ordered: true });
  });

  it("produit un sommaire aux ancres uniques", () => {
    expect(tableOfContents(blocks)).toEqual([
      { id: "se-soigner-la-nuit", text: "Se soigner la nuit", level: 2 },
      { id: "detail", text: "Détail", level: 3 },
      { id: "se-soigner-la-nuit-2", text: "Se soigner la nuit", level: 2 },
    ]);
  });

  it("n'accepte que des liens internes ou https ; le reste reste du texte", () => {
    expect(safeHref("/guide/sante")).toEqual({ href: "/guide/sante", external: false });
    expect(safeHref("https://www.exemple.ci/page")).toEqual({ href: "https://www.exemple.ci/page", external: true });
    for (const url of ["javascript:alert(1)", "//evil.example", "http://exemple.ci", "data:text/html,x"]) expect(safeHref(url)).toBeNull();
    expect(parseInline("[clic](javascript:alert(1))")).toEqual([{ kind: "text", text: "[clic](javascript:alert(1)" }, { kind: "text", text: ")" }]);
  });

  it("ne produit jamais de HTML : les balises restent du texte", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ kind: "text", text: "<script>alert(1)</script>" }]);
  });

  it("ancres et temps de lecture", () => {
    expect(anchorId("Santé & urgences !")).toBe("sante-urgences");
    expect(readingMinutes("mot ".repeat(600))).toBe(3);
    expect(readingMinutes("court")).toBe(1);
  });
});

describe("statut annoncé d'un article", () => {
  const now = new Date("2026-10-22T00:00:00Z");
  it("vérifié récent, ancien, à confirmer, exemple", () => {
    expect(articleTrust("verified", "2026-06-01T00:00:00Z", now).kind).toBe("verified");
    expect(articleTrust("verified", "2025-01-01T00:00:00Z", now).kind).toBe("stale");
    expect(articleTrust("pending_validation", null, now).kind).toBe("unverified");
    expect(articleTrust("verified", null, now).kind).toBe("unverified");
    expect(articleTrust("placeholder", null, now).kind).toBe("example");
  });
});

describe("ressources du site liées à une rubrique", () => {
  const all = [
    { id: "1", slug: "services-professionnels", name: "Services", parent_id: null },
    { id: "2", slug: "sante", name: "Santé", parent_id: "1" },
    { id: "3", slug: "commerces-boutiques", name: "Commerces", parent_id: null },
    { id: "4", slug: "alimentation", name: "Alimentation", parent_id: "3" },
    { id: "5", slug: "immobilier", name: "Immobilier", parent_id: null },
    { id: "6", slug: "immobilier-location", name: "Location", parent_id: "5" },
    { id: "7", slug: "plages-sites-naturels", name: "Plages", parent_id: null },
    { id: "8", slug: "formation", name: "Formation", parent_id: null },
  ];
  const link = (slug: string) => resourceHref(all.find((item) => item.slug === slug)!, all);
  it("mène à la page qui présente la catégorie, sinon à la recherche", () => {
    expect(link("sante")).toBe("/services?metier=sante");
    expect(link("alimentation")).toBe("/commerces?type=alimentation");
    expect(link("commerces-boutiques")).toBe("/commerces");
    expect(link("immobilier-location")).toBe("/immobilier/location");
    expect(link("plages-sites-naturels")).toBe("/tourisme?type=plages-sites-naturels");
    expect(link("formation")).toBe("/recherche?categorie=formation");
  });
});
