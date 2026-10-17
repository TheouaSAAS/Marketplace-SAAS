// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOOTER_SECTIONS, NAV_FAMILIES } from "./navigation";
import { ROUTES } from "./routes";

const seed = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
const allLinks = [...NAV_FAMILIES.flatMap((family) => family.links), ...FOOTER_SECTIONS.flatMap((section) => section.links)];

describe("navigation", () => {
  it("propose exactement les trois familles Découvrir, Trouver, Entreprendre", () => {
    expect(NAV_FAMILIES.map((family) => family.label)).toEqual(["Découvrir", "Trouver", "Entreprendre"]);
  });

  it("ne pointe que vers des routes déclarées", () => {
    for (const link of allLinks) expect(ROUTES).toHaveProperty(link.route);
  });

  it("n'utilise que des catégories présentes dans les données de référence", () => {
    const slugs = allLinks.flatMap((link) => (link.category ? [link.category] : []));
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) expect(seed).toContain(`'${slug}'`);
  });

  it("met en avant le parcours « Nouveau à San Pedro ? »", () => {
    const discover = NAV_FAMILIES.find((family) => family.key === "decouvrir");
    expect(discover?.links.some((link) => link.route === "newcomer" && link.label === "Nouveau à San Pedro ?")).toBe(true);
  });

  it("donne accès aux trois pages légales depuis le pied de page", () => {
    const footerRoutes = FOOTER_SECTIONS.flatMap((section) => section.links.map((link) => link.route));
    expect(footerRoutes).toEqual(expect.arrayContaining(["legalNotice", "terms", "privacy"]));
  });
});
