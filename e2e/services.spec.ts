import { expect, test, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

// Compte dédié (E2E_USER2), comme la fiche annonce : un seul projet l'utilise.
const email = process.env.E2E_USER2_EMAIL;
const password = process.env.E2E_USER2_PASSWORD;
const DEMO = "/professionnels/exemple-climatisation";
const NETWORK = 20_000;

async function fillQuote(page: Page) {
  await page.getByLabel("Prestation souhaitée").fill("Réparation d’un climatiseur");
  await page.getByLabel("Votre besoin").fill("Test automatique : la climatisation ne refroidit plus, à ignorer.");
  await page.getByLabel("Votre nom").fill("Testeur E2E");
  await page.getByLabel("Téléphone").fill("0700000000");
}

test.describe("Services de proximité", () => {
  test("un besoin en langage courant est rapproché d'un métier", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Services de proximité");
    await page.getByRole("searchbox", { name: "Décrivez votre besoin" }).fill("ma climatisation ne fonctionne plus");
    await page.getByRole("button", { name: "Trouver" }).click();
    await expect(page.getByText("Métier reconnu : Climatisation et froid")).toBeVisible({ timeout: NETWORK });
    await expect(page.getByText(/sans intelligence artificielle/)).toBeVisible();
    await page.getByText("Pourquoi cet ordre ?").click();
    await expect(page.getByText(/Aucune mise en avant n’est payante/)).toBeVisible();
  });

  test("la fiche de démonstration est signalée comme fictive et exige l'accord de transmission", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    const response = await page.goto(DEMO);
    test.skip(response?.status() !== 200, "Démonstration désactivée");
    await expect(page.getByText("Exemple de démonstration")).toBeVisible();
    await expect(page.getByText(/Rien n’est garanti en temps réel/)).toBeVisible();
    await expect(page.getByText(/Horaires non renseignés|à confirmer avant de vous déplacer/)).toBeVisible();

    await fillQuote(page);
    await page.getByRole("button", { name: "Envoyer la demande de devis" }).click();
    await expect(page.getByText("Votre accord est nécessaire pour transmettre vos coordonnées.")).toBeVisible({ timeout: NETWORK });

    // Sans compte, la demande passe par la connexion.
    await page.getByLabel(/J’accepte que mon nom/).check();
    await page.getByRole("button", { name: "Envoyer la demande de devis" }).click();
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fprofessionnels%2Fexemple-climatisation/, { timeout: NETWORK });
  });

  test("« Mes demandes de devis » exige une connexion", async ({ page }) => {
    await page.goto("/devis");
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fdevis/);
  });

  test("avec un compte : demande de devis puis suivi dans « Mes demandes de devis »", async ({ page }, testInfo) => {
    test.skip(!HAS_DATABASE || !email || !password, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    test.setTimeout(120_000);
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(email!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password!);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });

    const response = await page.goto(DEMO);
    test.skip(response?.status() !== 200, "Démonstration désactivée");
    await fillQuote(page);
    await page.getByLabel(/J’accepte que mon nom/).check();
    await page.getByRole("button", { name: "Envoyer la demande de devis" }).click();
    await expect(page.getByText(/Demande envoyée/)).toBeVisible({ timeout: NETWORK });

    await page.goto("/devis");
    const sent = page.getByRole("region", { name: /Demandes envoyées/ });
    await expect(sent.getByRole("link", { name: /Exemple — Climatisation/ })).toBeVisible();
    await expect(sent.getByText("Nouvelle")).toBeVisible();
    await expect(sent.getByText("À définir")).toBeVisible();
    // L'expéditeur ne peut pas changer le statut : ce suivi appartient au professionnel.
    await expect(sent.getByLabel("Statut")).toHaveCount(0);
  });
});
