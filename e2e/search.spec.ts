import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const LOGIN_TIMEOUT = 20_000;

/** Les filtres sont repliés sur mobile, toujours visibles sur ordinateur. */
async function openFilters(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByText("Filtres et tri", { exact: true }).first().click();
}

const results = (page: Page) => page.getByRole("region", { name: /résultat/ });

test.describe("Recherche", () => {
  test("l'aperçu sépare les types et indique type et fraîcheur de chaque résultat", async ({ page }) => {
    await page.goto("/recherche");
    const tabs = page.getByRole("navigation", { name: "Types de résultats" });
    await expect(tabs.getByRole("link", { name: "Aperçu" })).toHaveAttribute("aria-current", "page");
    for (const label of ["Annonces", "Lieux et commerces", "Professionnels", "Événements", "Guide pratique"]) {
      await expect(tabs.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }
    const empty = await page.getByRole("heading", { name: "Aucun résultat", exact: true }).isVisible();
    test.skip(empty, "Aucun contenu publié (démonstration désactivée)");
    await expect(page.getByRole("heading", { name: /^Annonces \(\d+\)$/ })).toBeVisible();
    await expect(page.getByText(/^Annonce · publiée le /).first()).toBeVisible();
    await expect(page.getByText(/^Lieu · mis à jour le /).first()).toBeVisible();
    await page.getByText("Pourquoi cet ordre ?").first().click();
    await expect(page.getByText(/Aucun résultat n’est sponsorisé/).first()).toBeVisible();
  });

  test("une phrase est interprétée, expliquée et réversible", async ({ page }) => {
    await page.goto("/recherche");
    await page.getByRole("searchbox", { name: "Que recherchez-vous ?" }).fill("logement à louer près de moi");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();

    const notice = page.getByRole("status").filter({ hasText: "Nous avons interprété votre recherche" });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("listitem")).toHaveText(["Annonces immobilières à louer", "Près de vous", "Mots-clés : « logement »"]);
    await expect(page.getByRole("navigation", { name: "Types de résultats" }).getByRole("link", { name: /Annonces/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("link", { name: "Retirer le filtre « Location »" })).toBeVisible();
    // La position n'est jamais dans l'adresse, et elle n'est pas demandée sans clic.
    expect(page.url()).not.toMatch(/lat|lng/);

    await notice.getByRole("link", { name: /Rechercher plutôt le texte exact/ }).click();
    await expect(page).toHaveURL(/brut=1/);
    await expect(page.getByText("Nous avons interprété votre recherche")).toHaveCount(0);
  });

  test("filtres dans l'adresse, retrait d'un filtre et état sans résultat utile", async ({ page, isMobile }) => {
    await page.goto("/recherche?type=annonces");
    await openFilters(page, isMobile);
    await page.getByLabel("Informations vérifiées uniquement").check();
    await page.getByRole("button", { name: "Appliquer" }).click();

    // Les champs vides du formulaire disparaissent de l'adresse.
    await expect(page).toHaveURL(/\/recherche\?type=annonces&verifie=1$/);
    await expect(page.getByRole("link", { name: "Retirer le filtre « Vérifiés uniquement »" })).toBeVisible();

    const none = page.getByRole("heading", { name: "Élargir la recherche" });
    if (await none.isVisible()) {
      await page.getByRole("link", { name: "Retirer « Vérifiés uniquement »" }).click();
    } else {
      await page.getByRole("link", { name: "Retirer le filtre « Vérifiés uniquement »" }).click();
    }
    await expect(page).toHaveURL(/\/recherche\?type=annonces$/);
  });

  test("changer d'onglet garde le texte mais pas les filtres propres à un type", async ({ page }) => {
    await page.goto("/recherche?q=exemple&type=annonces&prix_max=50000&verifie=1");
    await page.getByRole("navigation", { name: "Types de résultats" }).getByRole("link", { name: /Événements/ }).click();
    await expect(page).toHaveURL(/\/recherche\?q=exemple&type=evenements&verifie=1$/);
  });

  test("une recherche sans résultat propose d'élargir", async ({ page }) => {
    await page.goto("/recherche?q=zzqqxx&type=lieux");
    await expect(page.getByText("Aucun résultat pour « zzqqxx »")).toBeVisible();
    await expect(page.getByRole("link", { name: "Chercher dans tous les types" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Parcourir les rubriques" })).toBeVisible();
  });

  test("« Autour de moi » : position sur autorisation, tri par distance, jamais dans l'adresse", async ({ page, context, isMobile }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 4.7485, longitude: -6.6363 });
    await page.goto("/recherche?type=lieux");
    await page.getByRole("button", { name: "Utiliser ma position" }).click();
    // Le rafraîchissement relance toute la recherche : délai réseau.
    await expect(page.getByText("Position utilisée (arrondie à environ 100 m, non enregistrée).")).toBeVisible({ timeout: 15_000 });

    await openFilters(page, isMobile);
    await expect(page.getByLabel("Distance")).toBeEnabled();
    await page.getByLabel("Trier par").selectOption("proximite");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page).toHaveURL(/tri=proximite/);
    expect(page.url()).not.toMatch(/4\.74|6\.63/);
    // Navigation côté client : attendre la fin du chargement des résultats avant de conclure.
    await expect(
      page.getByText(/^Trié par : distance/).or(page.getByRole("heading", { name: "Aucun résultat", exact: true })),
    ).toBeVisible({ timeout: 15_000 });
    const empty = await page.getByRole("heading", { name: "Aucun résultat", exact: true }).isVisible();
    if (!empty) await expect(results(page).getByText(/ · à (environ )?\d/).first()).toBeVisible();

    await page.getByRole("button", { name: "Ne plus utiliser ma position" }).click();
    await expect(page.getByRole("button", { name: "Utiliser ma position" })).toBeVisible();
  });

  test("sans compte, enregistrer une recherche passe par la connexion", async ({ page }) => {
    await page.goto("/recherche");
    const empty = await page.getByRole("heading", { name: "Aucun résultat", exact: true }).isVisible();
    test.skip(empty, "Aucun contenu publié (démonstration désactivée)");
    await page.goto("/recherche?q=exemple&type=lieux");
    await page.getByRole("button", { name: "Enregistrer cette recherche" }).click();
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Frecherche%3Fq%3Dexemple%26type%3Dlieux/);
  });

  test("avec un compte : enregistrer, retrouver dans le profil, supprimer", async ({ page }, testInfo) => {
    test.skip(!email || !password, "Supabase non configuré");
    // Compte de test partagé entre projets : un seul projet manipule ses recherches.
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    test.setTimeout(90_000);
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(email!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password!);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profil$/, { timeout: LOGIN_TIMEOUT });

    await page.goto("/recherche?q=exemple&type=lieux");
    const empty = await page.getByRole("heading", { name: "Aucun résultat", exact: true }).isVisible();
    test.skip(empty, "Aucun contenu publié (démonstration désactivée)");
    await page.getByRole("button", { name: "Enregistrer cette recherche" }).click();
    await page.getByLabel("Nom de la recherche").fill("Lieux d'exemple E2E");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Recherche enregistrée. Retrouvez-la dans votre profil.")).toBeVisible({ timeout: LOGIN_TIMEOUT });

    await page.goto("/profil");
    const saved = page.getByRole("link", { name: "Lieux d'exemple E2E" });
    await expect(saved).toHaveAttribute("href", "/recherche?q=exemple&type=lieux");
    await page.getByRole("button", { name: "Supprimer la recherche « Lieux d'exemple E2E »" }).click();
    await expect(page.getByText("Recherche supprimée.")).toBeVisible({ timeout: LOGIN_TIMEOUT });
    await page.reload();
    await expect(saved).toHaveCount(0);
  });
});
