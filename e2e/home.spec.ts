import { expect, test } from "@playwright/test";

test.describe("Accueil dynamique", () => {
  test("la recherche en langage courant mène aux résultats", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Que recherchez-vous à San Pedro ?" });
    await search.fill("studio meublé à la Cité");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/recherche\?q=studio\+meubl/);
    await expect(page.getByText("Votre recherche : « studio meublé à la Cité »")).toBeVisible();
  });

  test("les suggestions de recherche sont des liens fonctionnels", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("list", { name: "Exemples de recherche" }).getByRole("link", { name: "Électricien" }).click();
    await expect(page.getByText("Votre recherche : « Électricien »")).toBeVisible();
  });

  test("les huit accès rapides et l'accès signature fonctionnent", async ({ page }) => {
    await page.goto("/");
    const quick = page.getByRole("navigation", { name: "Accès rapides" });
    await expect(quick.getByRole("link")).toHaveCount(8);
    await quick.getByRole("link", { name: "Restaurants" }).click();
    await expect(page).toHaveURL(/\/decouvrir\?categorie=restaurants-gastronomie$/);
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "Nouveau à San Pedro ?" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nouveau à San Pedro ?");
  });

  test("les sections affichent des contenus réels ou un état vide explicite", async ({ page }) => {
    await page.goto("/");
    for (const title of ["Annonces récentes", "Découvrir San Pedro", "Commerces et professionnels", "Événements à venir"]) {
      const section = page.getByRole("region", { name: title });
      await expect(section, title).toBeVisible();
      // Soit des cartes, soit un état vide : jamais une section blanche.
      const cards = await section.getByRole("article").count();
      if (cards === 0) await expect(section.getByRole("link").nth(1), title).toBeVisible();
    }
  });

  test("aucun exemple n'est présenté comme vérifié et la démonstration est annoncée", async ({ page }) => {
    await page.goto("/");
    const examples = page.getByRole("main").getByText("Exemple · à valider localement");
    const count = await examples.count();
    if (count > 0) {
      await expect(page.getByText("Phase de lancement : contenus de démonstration")).toBeVisible();
      for (const card of await page.getByRole("article").filter({ hasText: "Exemple —" }).all()) {
        await expect(card.getByText("Vérifié", { exact: true })).toHaveCount(0);
      }
    }
  });

  test("chaque section explique sa règle de sélection", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "Annonces récentes" });
    await section.getByText("Pourquoi ces contenus ?").click();
    await expect(section.getByText(/Aucune annonce n’est mise en avant contre paiement/)).toBeVisible();
  });

  test("les données structurées du site sont présentes", async ({ page }) => {
    await page.goto("/");
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(jsonLd!);
    expect(data["@type"]).toBe("WebSite");
    expect(data.potentialAction["@type"]).toBe("SearchAction");
  });

  test("l'accueil ne déborde pas sur 360 px et garde les actions au pouce", async ({ page, isMobile }) => {
    test.skip(!isMobile, "spécifique au mobile");
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const cta = await page.getByRole("main").getByRole("link", { name: "Nouveau à San Pedro ?" }).boundingBox();
    expect(cta!.y + cta!.height).toBeLessThanOrEqual(740);
  });
});
