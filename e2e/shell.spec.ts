import { expect, test } from "@playwright/test";

test.describe("Shell — rubriques", () => {
  test("les pages d'aide et de confiance sont complètes et indexables", async ({ page }) => {
    const pages: [string, string][] = [
      ["/aide", "Aide"],
      ["/verification", "Comment nous vérifions les informations"],
      ["/signaler", "Signaler un contenu"],
      ["/contact", "Contact"],
    ];
    for (const [path, title] of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(title);
      await expect(page.locator('meta[name="robots"][content*="noindex"]'), path).toHaveCount(0);
    }
    await page.goto("/aide");
    await page.getByText("Ma position est-elle enregistrée ?").click();
    await expect(page.getByText(/jamais enregistrée par la plateforme/)).toBeVisible();
  });

  test("les favoris exigent une connexion", async ({ page }) => {
    await page.goto("/favoris");
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Ffavoris$/);
  });

  test("aucune rubrique ne déborde sur un écran de 360 px", async ({ page, isMobile }) => {
    test.skip(!isMobile, "spécifique au mobile");
    await page.setViewportSize({ width: 360, height: 740 });
    for (const path of ["/annonces", "/tourisme", "/aide", "/verification", "/recherche", "/connexion", "/inscription"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("Shell — assistant et hors ligne", () => {
  test("l'assistant s'ouvre sans gêner la navigation et n'invente rien", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Demandez à San Pedro" }).click();
    const panel = page.getByRole("dialog", { name: "Demandez à San Pedro" });
    await expect(panel.getByText("Réponses rédigées non activées")).toBeVisible();
    await panel.getByRole("link", { name: /Guide pratique/ }).click();
    await expect(page).toHaveURL(/\/guide$/);
  });

  test("le bouton de l'assistant ne recouvre pas la barre basse", async ({ page, isMobile }) => {
    test.skip(!isMobile, "spécifique au mobile");
    await page.goto("/");
    const fab = await page.getByRole("button", { name: "Demandez à San Pedro" }).boundingBox();
    const bar = await page.getByRole("navigation", { name: "Navigation rapide" }).boundingBox();
    expect(fab!.y + fab!.height).toBeLessThanOrEqual(bar!.y);
  });

  test("sans réseau, la page « Hors ligne » remplace l'erreur du navigateur", async ({ page, context }) => {
    await page.goto("/");
    // `ready` ne se résout qu'une fois le service worker actif (page hors ligne déjà en cache).
    // Attention : waitForFunction avec une fonction async ne fonctionne pas (une promesse est toujours « vraie »).
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
    await page.goto("/annonces").catch(() => {});
    await expect(page.getByText("Vous êtes hors ligne").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
    await context.setOffline(false);
  });
});
