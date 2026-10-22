import { expect, test } from "@playwright/test";

const SECTIONS: [string, string][] = [
  ["/annonces", "Annonces et opportunités"],
  ["/emploi", "Emploi et opportunités"],
  ["/professionnels", "Professionnels et entreprises"],
  ["/guide", "Guide pratique"],
  ["/quartiers", "Quartiers"],
  ["/carte", "Carte interactive"],
  ["/evenements", "Événements"],
  ["/publier", "Publier une annonce"],
  ["/offres", "Offres pour les professionnels"],
];

test.describe("Shell — rubriques", () => {
  test("toutes les rubriques majeures sont accessibles, explicites et non indexées", async ({ page }) => {
    test.setTimeout(90_000);
    for (const [path, title] of SECTIONS) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(title);
      await expect(page.getByText("En préparation", { exact: true }), path).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Fil d’Ariane" }), path).toBeVisible();
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", /noindex/);
    }
  });

  test("une rubrique présente ses catégories réelles et la catégorie choisie", async ({ page }) => {
    test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL, "Supabase non configuré");
    await page.goto("/emploi");
    await page.getByRole("link", { name: "Stages", exact: true }).click();
    await expect(page).toHaveURL(/\/emploi\?categorie=stages$/);
    await expect(page.getByText("Catégorie : Stages")).toBeVisible();
  });

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
    await expect(panel.getByText("L’assistant n’est pas encore disponible")).toBeVisible();
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
