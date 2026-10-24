// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOOTER_SECTIONS, MOBILE_TABS, NAV_SECTIONS, NEWCOMER_LINK } from "./navigation";
import { hasPage, ROUTES, type RouteStatus } from "./routes";

const seed = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
const allLinks = [
  ...NAV_SECTIONS.flatMap((section) => section.links),
  ...FOOTER_SECTIONS.flatMap((section) => section.links),
  NEWCOMER_LINK,
];

describe("navigation", () => {
  it("propose les trois rubriques du cahier des charges", () => {
    expect(NAV_SECTIONS.map((section) => section.label)).toEqual([
      "Annonces & opportunités",
      "Découvrir & sortir",
      "Services & professionnels",
    ]);
  });

  it("met en avant l'accès signature « Nouveau à San Pedro ? »", () => {
    expect(NEWCOMER_LINK).toEqual({ label: "Nouveau à San Pedro ?", route: "newcomer" });
    expect(hasPage("newcomer")).toBe(true);
  });

  it("ne pointe que vers des routes déclarées", () => {
    for (const link of allLinks) expect(ROUTES).toHaveProperty(link.route);
  });

  it("rend toutes les rubriques majeures accessibles (aucun lien « Bientôt » dans les menus)", () => {
    for (const link of NAV_SECTIONS.flatMap((section) => section.links)) {
      expect(hasPage(link.route), link.label).toBe(true);
    }
  });

  it("n'utilise que des catégories présentes dans les données de référence", () => {
    const slugs = allLinks.flatMap((link) => (link.category ? [link.category] : []));
    expect(slugs.length).toBeGreaterThan(5);
    for (const slug of slugs) expect(seed, slug).toContain(`'${slug}'`);
  });

  it("donne accès aux pages légales, à l'aide, au signalement et à la méthode de vérification depuis le pied de page", () => {
    const footerRoutes = FOOTER_SECTIONS.flatMap((section) => section.links.map((link) => link.route));
    expect(footerRoutes).toEqual(expect.arrayContaining(["legalNotice", "terms", "privacy", "help", "report", "verificationPolicy"]));
  });

  it("propose cinq onglets mobiles menant tous à une page réelle", () => {
    expect(MOBILE_TABS).toHaveLength(5);
    for (const tab of MOBILE_TABS) expect(hasPage(tab.route), tab.label).toBe(true);
  });

  it("ne laisse plus aucune rubrique en écran d'attente : chaque lien mène à une page terminée ou est marqué « Bientôt »", () => {
    expect(Object.entries(ROUTES).filter(([, route]) => (route.status as RouteStatus) === "preview").map(([key]) => key)).toEqual([]);
  });
});
