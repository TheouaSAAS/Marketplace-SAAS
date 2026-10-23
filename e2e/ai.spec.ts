import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;

test.describe("Couche IA", () => {
  test("sans information vérifiée, l'assistant le dit au lieu d'inventer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Demandez à San Pedro" }).click();
    const panel = page.getByRole("dialog", { name: "Demandez à San Pedro" });
    await panel.getByLabel(/Votre question/).fill("Quel est le tarif du téléphérique xqzvwk de la plorbitude ?");
    await panel.getByRole("button", { name: "Demander" }).click();
    await expect(panel.getByText("Je ne dispose pas d’information vérifiée sur ce sujet.")).toBeVisible({ timeout: NETWORK });
    await expect(panel.getByRole("link", { name: "Chercher dans tout le site" })).toHaveAttribute("href", /\/recherche\?q=/);
  });

  test("le plan nouvel arrivant propose une question sourcée", async ({ page }) => {
    await page.goto("/nouveau-arrivant/plan?motif=s_installer&duree=longue_duree&logement=location&priorites=sante");
    await expect(page.getByRole("heading", { name: "Une question sur votre installation ?" })).toBeVisible({ timeout: NETWORK });
    await expect(page.getByLabel(/Votre question sur l’installation/)).toBeVisible();
  });

  test("le pilotage de l'IA est réservé aux administrateurs et montre l'interrupteur", async ({ page }, testInfo) => {
    test.skip(!HAS_DATABASE || !process.env.E2E_ADMIN_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
    await page.goto("/admin");
    await page.getByRole("link", { name: "Piloter l’intelligence artificielle" }).click();
    await expect(page.getByRole("heading", { name: "Interrupteur général" })).toBeVisible({ timeout: NETWORK });
    await expect(page.getByRole("heading", { name: "Garde-fous" })).toBeVisible();
    await expect(page.getByText(/^Assistant « Demandez à San Pedro »/)).toBeVisible();
  });
});
