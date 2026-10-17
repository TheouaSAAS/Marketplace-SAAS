import { expect, test, type Page } from "@playwright/test";

const SLOGAN = "Votre ville, mille opportunités";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "la page déborde horizontalement").toBeLessThanOrEqual(0);
}

test.describe("Fondations — tous écrans", () => {
  test("l'accueil affiche la marque officielle sans débordement", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SLOGAN);
    await expect(page).toHaveTitle(`Carrefour des Possibles — ${SLOGAN}`);
    await expect(page.getByText("San Pedro").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("le lien d'évitement mène au contenu principal", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#contenu$/);
  });

  test("une page inconnue renvoie une 404 utile", async ({ page }) => {
    const response = await page.goto("/cette-page-n-existe-pas");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Cette page est introuvable")).toBeVisible();
    await page.getByRole("link", { name: "Retour à l’accueil" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SLOGAN);
  });

  test("le système de design s'affiche sans débordement", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page.getByRole("heading", { name: "Système de design" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("la modale du système de design s'ouvre et se ferme avec Échap", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Ouvrir une modale" }).click();
    const dialog = page.getByRole("dialog", { name: "Retirer l’annonce ?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("une notification apparaît puis peut être fermée", async ({ page }) => {
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Notification de succès" }).click();
    const toast = page.getByRole("status").filter({ hasText: "Annonce enregistrée" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Fermer la notification" }).click();
    await expect(toast).toBeHidden();
  });
});

test.describe("Navigation mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "spécifique au mobile");

  test("le menu s'ouvre, présente les familles et se ferme", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    for (const family of ["Découvrir", "Trouver", "Entreprendre"]) {
      await expect(menu.getByText(family, { exact: true })).toBeVisible();
    }
    await expect(menu.getByText("Nouveau à San Pedro ?")).toBeVisible();
    await expect(menu.getByRole("button", { name: "Publier" })).toBeDisabled();

    await menu.getByText("Trouver", { exact: true }).click();
    await expect(menu.getByText("Immobilier")).toBeVisible();

    await menu.getByRole("button", { name: "Fermer" }).click();
    await expect(menu).toBeHidden();
  });

  test("aucun débordement sur un petit écran de 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const path of ["/", "/design-system", "/introuvable"]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("les cibles tactiles de l'en-tête mesurent au moins 44 px", async ({ page }) => {
    await page.goto("/");
    const box = await page.getByRole("button", { name: "Ouvrir le menu" }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe("Navigation ordinateur", () => {
  test.skip(({ isMobile }) => isMobile, "spécifique à l'ordinateur");

  test("chaque famille ouvre son menu, qui se ferme avec Échap", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    for (const family of ["Découvrir", "Trouver", "Entreprendre"]) {
      const trigger = nav.getByRole("button", { name: family });
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("les pages non livrées ne sont jamais proposées en lien", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name: "Découvrir" }).click();
    await expect(page.getByRole("link", { name: "Carte de la ville" })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("button", { name: "Publier" })).toBeDisabled();
  });
});
