import { expect, test, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

// Compte dédié (E2E_USER2) : indépendant des tests de profil qui tournent en parallèle.
const email = process.env.E2E_USER2_EMAIL;
const password = process.env.E2E_USER2_PASSWORD;
const DEMO = "/annonces/exemple-logement-location";
const NETWORK = 20_000;

async function signIn(page: Page) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email!);
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
}

test.describe("Fiche d'une annonce", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("présente l'annonce, son état de vérification et protège la localisation", async ({ page }) => {
    const response = await page.goto(DEMO);
    test.skip(response?.status() !== 200 || (await page.getByText("introuvable").count()) > 0, "Démonstration désactivée");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Logement à louer");
    await expect(page.getByText("Exemple de démonstration", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Description" })).toBeVisible();
    await expect(page.getByText("Quartier seulement.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Fil d’Ariane" })).toContainText("Annonces");
    // Un exemple de démonstration n'est jamais indexé.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("une annonce inconnue est introuvable", async ({ page }) => {
    await page.goto("/annonces/annonce-qui-n-existe-pas");
    await expect(page.getByText(/introuvable/i).first()).toBeVisible();
  });

  test("sans compte, écrire à l'annonceur passe par la connexion", async ({ page }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Envoyer par la messagerie" }).click();
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fannonces%2Fexemple-logement-location/, { timeout: NETWORK });
  });

  test("une carte d'annonce de la recherche mène à sa fiche", async ({ page }) => {
    await page.goto("/recherche?type=annonces");
    const first = page.getByRole("region", { name: /résultat/ }).getByRole("link").first();
    const title = await first.textContent();
    await first.click();
    await expect(page).toHaveURL(/\/annonces\/[a-z0-9-]+$/, { timeout: NETWORK });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title ?? "", { timeout: NETWORK });
  });

  test("avec un compte : favori, « j'aime », commentaire et message", async ({ page }, testInfo) => {
    test.skip(!email || !password, NO_DATABASE);
    // Compte de test partagé entre projets : un seul projet manipule ses données.
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    test.setTimeout(120_000);
    await signIn(page);
    await page.goto(DEMO);

    await page.getByRole("button", { name: "Ajouter aux favoris" }).click();
    await expect(page.getByRole("button", { name: "Dans mes favoris" })).toBeVisible({ timeout: NETWORK });
    await page.goto("/favoris");
    await expect(page.getByRole("link", { name: /Logement à louer/ })).toBeVisible();
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Dans mes favoris" }).click();
    await expect(page.getByRole("button", { name: "Ajouter aux favoris" })).toBeVisible({ timeout: NETWORK });

    await page.getByRole("button", { name: /^J’aime/ }).click();
    await expect(page.getByRole("button", { name: /^Je n’aime plus/ })).toBeVisible({ timeout: NETWORK });
    await page.getByRole("button", { name: /^Je n’aime plus/ }).click();
    await expect(page.getByRole("button", { name: /^J’aime/ })).toBeVisible({ timeout: NETWORK });

    await page.getByLabel("Poser une question publique").fill("Mon numéro est le 07 07 12 34 56");
    await page.getByRole("button", { name: "Publier le commentaire" }).click();
    await expect(page.getByText(/Pas de téléphone ni d.e-mail dans un commentaire public/)).toBeVisible({ timeout: NETWORK });
    await page.getByLabel("Poser une question publique").fill("Question de test automatique, à ignorer.");
    await page.getByRole("button", { name: "Publier le commentaire" }).click();
    const comment = page.getByRole("listitem").filter({ hasText: "Question de test automatique" });
    await expect(comment).toBeVisible({ timeout: NETWORK });
    page.once("dialog", (dialog) => dialog.accept());
    await comment.getByRole("button", { name: "Supprimer" }).click();
    await expect(comment).toHaveCount(0, { timeout: NETWORK });

    await page.getByLabel("Votre message à l’annonceur").fill("Message de test automatique, à ignorer.");
    // Charte de confiance : demandée une seule fois par compte (version en vigueur).
    const charter = page.getByLabel(/J’accepte la charte de confiance/);
    if (await charter.isVisible()) await charter.check();
    await page.getByRole("button", { name: "Envoyer par la messagerie" }).click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/, { timeout: NETWORK });
    await expect(page.getByText("Message de test automatique, à ignorer.")).toBeVisible();
    await page.getByLabel("Votre message", { exact: true }).fill("Deuxième message de test.");
    await page.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(page.getByText("Deuxième message de test.")).toBeVisible({ timeout: NETWORK });
    await page.goto("/messages");
    await expect(page.getByRole("link", { name: /Logement à louer/ })).toBeVisible();
  });
});
