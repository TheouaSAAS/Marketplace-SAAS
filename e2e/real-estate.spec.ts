import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

test.describe("Immobilier", () => {
  test("l'accueil présente les quatre entrées et les conseils", async ({ page }) => {
    await page.goto("/immobilier");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Immobilier à San Pedro");
    for (const title of ["Logements à louer", "Biens et terrains à vendre", "Locations de courte durée", "Bureaux et locaux commerciaux"]) {
      await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    }
    await page.getByRole("link", { name: /Conseils pour se loger/ }).click();
    await expect(page.getByRole("heading", { name: "Avant une visite ou un paiement" })).toBeVisible();
  });

  test("une phrase est traduite en filtres, et les filtres restent dans l'adresse", async ({ page, isMobile }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/immobilier/location");
    await page.getByRole("searchbox", { name: "Décrivez le bien recherché" }).fill("studio meublé à Cité");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await expect(page.getByText("Nous avons interprété votre recherche")).toBeVisible();
    await expect(page.getByText(/Type : studio · Meublé · Quartier : Cité/)).toBeVisible();

    if (isMobile) await page.getByText("Filtres et tri", { exact: true }).first().click();
    await page.getByLabel("Climatisation").check();
    await page.getByRole("button", { name: "Appliquer" }).click();
    // Adresse canonique : champs vides retirés, critères explicites.
    await expect(page).toHaveURL(/\/immobilier\/location\?type_bien=studio&meuble=oui&quartier=cite&equipements=climatisation$/);
  });

  test("une entrée professionnelle ne propose ni pièces ni mobilier", async ({ page, isMobile }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/immobilier/professionnel");
    if (isMobile) await page.getByText("Filtres et tri", { exact: true }).first().click();
    await expect(page.getByLabel("Surface minimale (m²)")).toBeVisible();
    await expect(page.getByLabel("Pièces (min.)")).toHaveCount(0);
    await expect(page.getByLabel("Mobilier")).toHaveCount(0);
  });

  test("la sélection à comparer s'affiche et se vide", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/immobilier/location");
    await page.evaluate(() => window.localStorage.removeItem("cdp-comparer-v1"));
    await page.reload();
    const toggle = page.getByRole("button", { name: "Comparer" }).first();
    test.skip((await toggle.count()) === 0, "Aucun bien publié");
    await toggle.click();
    const bar = page.getByRole("region", { name: "Biens à comparer" });
    await expect(bar).toContainText("1 / 3 biens sélectionnés");
    await expect(bar.getByText("Choisissez au moins 2 biens")).toBeVisible();
    await bar.getByRole("button", { name: "Vider" }).click();
    await expect(bar).toHaveCount(0);
  });

  test("comparer moins de deux biens explique quoi faire", async ({ page }) => {
    await page.goto("/immobilier/comparer?annonces=un-seul-bien");
    await expect(page.getByText("Choisissez au moins deux biens")).toBeVisible();
  });

  test("une fiche immobilière rappelle la fraîcheur et les règles de prudence", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    const response = await page.goto("/annonces/exemple-logement-location");
    test.skip(response?.status() !== 200 || (await page.getByText("introuvable").count()) > 0, "Démonstration désactivée");
    await expect(page.getByText(/^(Publiée|Confirmée|À reconfirmer)/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Conseils pour se loger" })).toBeVisible();
  });
});
