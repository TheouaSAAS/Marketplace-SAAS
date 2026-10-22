import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;

test.describe("Carte interactive", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("la liste et la carte sont synchronisées, avec une fiche rapide", async ({ page }) => {
    await page.goto("/carte");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carte interactive");
    await expect(page.getByRole("region", { name: /Carte des résultats/ })).toBeVisible();
    const list = page.getByRole("list", { name: "Résultats de la carte" });
    const first = list.getByRole("button").first();
    test.skip((await first.count()) === 0, "Aucun élément géolocalisé");
    // Deuxième ligne du bouton : le titre de l'élément.
    const title = (await first.locator(":scope > span").nth(1).innerText()).trim();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    const card = page.getByRole("region", { name: `Fiche rapide : ${title}` });
    await expect(card).toBeVisible();
    // Une position approximative n'ouvre pas d'itinéraire ; une fiche est toujours traçable.
    await expect(card.getByText(/Position approximative|Emplacement indiqué/)).toBeVisible();
    await expect(page.getByText(/Positions publiques uniquement/)).toBeVisible();
  });

  test("couches et quartier restent dans l'adresse", async ({ page }) => {
    await page.goto("/carte");
    const form = page.getByRole("form", { name: "Couches et quartier" });
    for (const label of ["Immobilier", "Services", "Tourisme", "Événements", "Emploi"]) await form.getByLabel(label).uncheck();
    await form.getByRole("button", { name: "Afficher" }).click();
    await expect(page).toHaveURL(/\/carte\?couches=commerces$/, { timeout: NETWORK });
    const layers = await page.getByRole("list", { name: "Résultats de la carte" }).locator("button > span:first-child").allInnerTexts();
    for (const text of layers) expect(text).toContain("Commerces");

    await page.getByRole("form", { name: "Couches et quartier" }).getByLabel("Quartier").selectOption("cite");
    await page.getByRole("form", { name: "Couches et quartier" }).getByRole("button", { name: "Afficher" }).click();
    await expect(page).toHaveURL(/\/carte\?couches=commerces&quartier=cite$/, { timeout: NETWORK });
    await expect(page.getByRole("status").filter({ hasText: /quartier Cité|Aucun élément/ })).toBeVisible();
  });

  test("déplacer la carte propose une recherche dans la zone", async ({ page, isMobile }) => {
    test.skip(isMobile, "Glisser-déposer testé sur ordinateur");
    await page.goto("/carte");
    const map = page.getByRole("region", { name: /Carte des résultats/ });
    // Carte initialisée (sans attendre les tuiles, servies par un tiers).
    await expect(map.locator(".leaflet-pane").first()).toBeAttached({ timeout: NETWORK });
    // La carte doit être à l'écran pour recevoir le glisser.
    await map.scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;
    await page.mouse.move(box.x + 60, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 140, { steps: 10 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Rechercher dans cette zone" }).click();
    await expect(page).toHaveURL(/\/carte\?zone=-?\d+(\.\d+)?%2C/, { timeout: NETWORK });
    await expect(page.getByRole("link", { name: "Effacer la zone" })).toBeVisible();
  });
});

test("sans base, la carte l'indique clairement", async ({ page }) => {
  test.skip(HAS_DATABASE, "Base configurée");
  await page.goto("/carte");
  await expect(page.getByText("Carte indisponible").first()).toBeVisible();
});
