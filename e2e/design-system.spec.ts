import { expect, test } from "@playwright/test";

test.describe("Design system — accessibilité et états", () => {
  test("les onglets se pilotent au clavier", async ({ page }) => {
    await page.goto("/design-system");
    const tablist = page.getByRole("tablist", { name: "Type de résultat" });
    await tablist.getByRole("tab", { name: /Annonces/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tablist.getByRole("tab", { name: /Lieux/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("Aucun lieu");
    // L'onglet désactivé est sauté.
    await page.keyboard.press("End");
    await expect(tablist.getByRole("tab", { name: /Événements/ })).toBeFocused();
  });

  test("le focus clavier est toujours visible", async ({ page, isMobile }) => {
    test.skip(isMobile, "navigation clavier : ordinateur");
    await page.goto("/design-system");
    await page.getByRole("button", { name: "Principal" }).focus();
    const outline = await page.getByRole("button", { name: "Principal" }).evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });

  test("les filtres exposent leur état et se retirent", async ({ page }) => {
    await page.goto("/design-system");
    const chip = page.getByRole("group", { name: "Filtres rapides" }).getByRole("button", { name: "Gratuit" });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Retirer le filtre Gratuit" }).click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  test("un bandeau signale la perte de connexion puis disparaît", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByText("Vous êtes hors ligne")).toHaveCount(0);
    await context.setOffline(true);
    await expect(page.getByText(/Vous êtes hors ligne/)).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(/Vous êtes hors ligne/)).toHaveCount(0);
  });

  test("tous les jetons de couleur sont disponibles dans la page", async ({ page }) => {
    await page.goto("/design-system");
    const missing = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const names = ["brand-300", "brand-900", "accent-300", "accent-900", "lagoon-500", "sand-300", "surface", "focus"];
      return names.filter((name) => !root.getPropertyValue(`--color-${name}`).trim());
    });
    expect(missing).toEqual([]);
  });

  test("les badges de vérification sont distincts", async ({ page }) => {
    await page.goto("/design-system");
    for (const label of ["Vérifié", "À vérifier", "Exemple · à valider localement"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });
});
