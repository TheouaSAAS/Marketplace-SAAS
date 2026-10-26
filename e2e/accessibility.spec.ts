import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";
import { signInAs } from "./sign-in";

/**
 * Audit automatique WCAG 2.2 AA (axe-core) des interfaces principales, sur
 * mobile et sur ordinateur. Sont bloquantes les violations « graves » et
 * « critiques ». L'audit manuel (lecteur d'écran, zoom, mouvement réduit) est
 * consigné dans docs/accessibility.md.
 */
const PAGES = [
  "/",
  "/annonces",
  "/annonces?categorie=voitures",
  "/immobilier",
  "/emploi",
  "/services",
  "/commerces",
  "/tourisme",
  "/evenements",
  "/professionnels",
  "/guide",
  "/quartiers",
  "/carte",
  "/recherche?q=studio",
  "/nouveau-arrivant",
  "/nouveau-arrivant/questions",
  "/aide",
  "/verification",
  "/signaler",
  "/contact",
  "/offres",
  "/connexion",
  "/admin/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/charte-de-confiance",
];

/** Fiches de démonstration (« Exemple / à valider localement ») : présentes seulement avec la base. */
const DETAIL_PAGES = [
  "/annonces/exemple-logement-location",
  "/lieux/exemple-lieu-a-visiter",
  "/evenements/exemple-evenement",
  "/professionnels/exemple-electricien",
  "/guide/se-deplacer/exemple-se-deplacer",
  "/quartiers/bardot",
  "/annonces/exemple-logement-location/accord",
];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const path of [...PAGES, ...DETAIL_PAGES]) {
  test(`accessibilité WCAG 2.2 AA : ${path}`, async ({ page }) => {
    test.skip(DETAIL_PAGES.includes(path) && !HAS_DATABASE, NO_DATABASE);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
    // Les contenus chargés à part (Suspense) doivent être en place.
    await page.waitForLoadState("networkidle").catch(() => {});
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    if (process.env.AXE_REPORT) {
      for (const violation of results.violations) console.log(`AXE ${path} ${violation.id} ${violation.impact} ${violation.nodes.length} ${violation.nodes[0]?.target.join(" ")}`);
    }
    const blocking = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    const summary = blocking.map((violation) => `${violation.id} (${violation.impact}) : ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 4).join(" | ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}

/** Interfaces connectées (lecture seule) : membre puis administrateur. */
const PRIVATE_PAGES: { account: "E2E_USER" | "E2E_ADMIN"; paths: string[] }[] = [
  { account: "E2E_USER", paths: ["/profil", "/tableau-de-bord", "/tableau-de-bord/annonces", "/tableau-de-bord/activite", "/tableau-de-bord/notifications", "/tableau-de-bord/confidentialite", "/publier", "/messages", "/favoris"] },
  { account: "E2E_ADMIN", paths: ["/admin", "/admin/signalements", "/admin/comptes", "/admin/journal", "/admin/qualite", "/admin/ia", "/admin/fraude", "/admin/recours"] },
];

for (const { account, paths } of PRIVATE_PAGES) {
  test(`accessibilité WCAG 2.2 AA des pages connectées (${account})`, async ({ page }, testInfo) => {
    test.skip(!process.env[`${account}_EMAIL`], "Comptes de test absents");
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(120_000);
    await signInAs(page, account);
    const problems: string[] = [];
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      for (const violation of results.violations) {
        if (process.env.AXE_REPORT) console.log(`AXE ${path} ${violation.id} ${violation.impact} ${violation.nodes.length} ${violation.nodes[0]?.target.join(" ")}`);
        if (violation.impact === "serious" || violation.impact === "critical") problems.push(`${path} ${violation.id} : ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}

test("le mouvement réduit est respecté et le focus clavier reste visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.getByRole("button", { name: "Demandez à San Pedro" }).evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThan(0.01);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  const outline = await skip.evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: parseFloat(style.outlineWidth), style: style.outlineStyle, shadow: style.boxShadow };
  });
  expect(outline.style !== "none" && outline.width > 0 || outline.shadow !== "none").toBe(true);
});
