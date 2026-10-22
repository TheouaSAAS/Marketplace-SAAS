import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;

test.describe("Tourisme et itinéraires", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("Découvrir propose les quatre entrées et l'itinéraire", async ({ page }) => {
    await page.goto("/decouvrir");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Découvrir et sortir");
    const entries = page.getByRole("navigation", { name: "Que cherchez-vous ?" });
    for (const name of ["Où dormir ?", "Où manger ?", "Que découvrir ?", "Sortir"]) {
      await expect(entries.getByRole("link", { name: new RegExp(name.replace("?", "\?")) })).toBeVisible();
    }
    await entries.getByRole("link", { name: /Sortir/ }).click();
    await expect(page).toHaveURL(/\/decouvrir\/sortir$/);
    await expect(page.getByRole("heading", { name: "Événements à venir" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avant de partir" })).toBeVisible();
  });

  test("les filtres touristiques restent dans l'adresse, y compris sur mobile", async ({ page, isMobile }) => {
    await page.goto("/tourisme");
    if (isMobile) await page.getByText("Filtres et tri", { exact: true }).first().click();
    await page.getByLabel("Plage").check();
    await page.getByLabel("Nature").check();
    await page.getByLabel("Familles").check();
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page).toHaveURL(/\/tourisme\?themes=nature%2Cplage&public=familles$/);
    await page.getByText("Pourquoi cet ordre ?").click();
    await expect(page.getByText(/Aucun lieu ne paie pour être mieux classé/)).toBeVisible();
  });

  test("l'itinéraire n'utilise que des lieux enregistrés et signale les moments sans lieu", async ({ page }) => {
    await page.goto("/tourisme/itineraire");
    await page.getByLabel("Deux jours").check();
    await page.getByLabel("Nature").check();
    await page.getByRole("button", { name: "Composer l’itinéraire" }).click();
    await expect(page).toHaveURL(/\/tourisme\/itineraire\?duree=deux_jours&themes=nature$/, { timeout: NETWORK });
    await expect(page.getByText("Comment il est composé")).toBeVisible();
    const steps = page.getByRole("region", { name: /Votre itinéraire/ }).locator("ol > li");
    await expect(steps).toHaveCount(7);
    // Chaque lieu proposé mène à une vraie fiche.
    const links = page.getByRole("region", { name: /Votre itinéraire/ }).locator('a[href^="/lieux/"]');
    for (const link of await links.all()) {
      const target = await link.getAttribute("href");
      const response = await page.request.get(target!);
      expect(response.status(), target!).toBe(200);
    }
    if ((await links.count()) < 7) await expect(page.getByText(/à compléter localement/).first()).toBeVisible();
  });

  test("une fiche touristique affiche source, statut et date, ou « à confirmer localement »", async ({ page }) => {
    const response = await page.goto("/lieux/exemple-site-naturel");
    test.skip(response?.status() !== 200 || (await page.getByText("Exemple de démonstration").count()) === 0, "Démonstration désactivée");
    await expect(page.getByRole("heading", { name: "Infos pratiques" })).toBeVisible();
    await expect(page.getByText("Information à confirmer localement").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Source et vérification" })).toBeVisible();
    await expect(page.getByText("Pas encore vérifiée par l’équipe locale")).toBeVisible();
    await expect(page.getByText(/Avertissement/).first()).toBeVisible();
    // Un site naturel n'a pas d'exploitant : pas de revendication.
    await expect(page.getByText("Vous êtes l’exploitant ? Revendiquer cette vitrine")).toHaveCount(0);
  });

  test("une entrée inconnue est introuvable", async ({ page }) => {
    await page.goto("/decouvrir/inconnue");
    await expect(page.getByText("Cette page est introuvable")).toBeVisible();
  });
});

test("sans base, les entrées touristiques l'indiquent clairement", async ({ page }) => {
  test.skip(HAS_DATABASE, "Base configurée");
  await page.goto("/decouvrir/ou-manger");
  await expect(page.getByText("Contenus indisponibles")).toBeVisible();
});
