import { expect, test, type Page } from "@playwright/test";

const SLOGAN = "Votre ville, mille opportunités";
const ACCROCHE = "Tout San Pedro, au même endroit.";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "la page déborde horizontalement").toBeLessThanOrEqual(0);
}

test.describe("Fondations — tous écrans", () => {
  test("l'accueil affiche la marque officielle sans débordement", async ({ page }) => {
    await page.goto("/");
    // Marque officielle + slogan exact (§2.1), accroche de la ville pilote en titre (décision D11).
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ACCROCHE);
    await expect(page.getByText(`Carrefour des Possibles — « ${SLOGAN} »`)).toBeVisible();
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ACCROCHE);
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

  test("le menu s'ouvre, présente les rubriques et l'accès signature, puis se ferme", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    for (const section of ["Annonces & opportunités", "Découvrir & sortir", "Services & professionnels"]) {
      await expect(menu.getByText(section, { exact: true })).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: "Nouveau à San Pedro ?" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Publier", exact: true })).toBeVisible();

    await menu.getByText("Services & professionnels", { exact: true }).click();
    await expect(menu.getByRole("link", { name: "Artisans et dépannage" })).toBeVisible();

    await menu.getByRole("button", { name: "Fermer" }).click();
    await expect(menu).toBeHidden();
  });

  test("la barre basse mène aux destinations principales sans masquer le contenu", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Navigation rapide" });
    await expect(bar).toBeVisible();
    await bar.getByRole("link", { name: "Rechercher" }).click();
    await expect(page).toHaveURL(/\/recherche$/);
    await expect(bar.getByRole("link", { name: "Rechercher" })).toHaveAttribute("aria-current", "page");

    // Le bas de page reste atteignable au-dessus de la barre fixe.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footerBottom = await page.getByText(/Tous droits réservés/).boundingBox();
    const barTop = await bar.boundingBox();
    expect(footerBottom!.y + footerBottom!.height).toBeLessThanOrEqual(barTop!.y + 1);
  });

  test("l'onglet Compte demande la connexion à un visiteur", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Navigation rapide" }).getByRole("link", { name: "Compte" }).click();
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fprofil$/);
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

  test("chaque rubrique ouvre son menu, qui se ferme avec Échap", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    for (const section of ["Annonces & opportunités", "Découvrir & sortir", "Services & professionnels"]) {
      const trigger = nav.getByRole("button", { name: section });
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("la navigation fonctionne entièrement au clavier", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await nav.getByRole("button", { name: "Découvrir & sortir" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveRole("link");
    await focused.press("Enter");
    await expect(page).toHaveURL(/\/tourisme$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tourisme");
  });

  test("l'en-tête donne accès à la recherche, aux favoris et à la publication", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    await banner.getByRole("searchbox").fill("studio meublé");
    await banner.getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/\/recherche\?q=studio\+meubl/);
    await expect(page.getByRole("searchbox", { name: "Que recherchez-vous ?" })).toHaveValue("studio meublé");
    await expect(banner.getByRole("link", { name: "Mes favoris" })).toHaveAttribute("href", "/favoris");
    await expect(banner.getByRole("link", { name: "Publier" })).toHaveAttribute("href", "/publier");
  });
});
