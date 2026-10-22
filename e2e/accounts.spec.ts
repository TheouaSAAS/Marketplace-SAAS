import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
// Connexion = action serveur + plusieurs allers-retours vers la base (Irlande) : délai réaliste.
const LOGIN_TIMEOUT = 20_000;

test.describe("Comptes", () => {
  test.skip(!email || !password, "Supabase non configuré : compte de test indisponible");

  test("un espace protégé redirige vers la connexion", async ({ page }) => {
    await page.goto("/profil");
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fprofil$/);
    await expect(page.getByText("Connectez-vous pour accéder à cette page.")).toBeVisible();
  });

  test("des identifiants faux sont refusés sans préciser lequel", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(email!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill("MauvaisMotDePasse1");
    await page.getByRole("button", { name: "Se connecter" }).click();
    // Next.js ajoute son propre annonceur de navigation (role="alert") : on cible notre message.
    await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText("Adresse e-mail ou mot de passe incorrect.", {
      timeout: LOGIN_TIMEOUT,
    });
    await expect(page.getByLabel("Adresse e-mail")).toHaveValue(email!);
  });

  test("connexion, profil, export des données puis déconnexion", async ({ page, isMobile }) => {
    test.setTimeout(90_000);
    // Une redirection externe demandée après connexion est ignorée.
    await page.goto("/connexion?suivant=https%3A%2F%2Fpirate.example");
    await page.getByLabel("Adresse e-mail").fill(email!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password!);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL(/\/profil$/, { timeout: LOGIN_TIMEOUT });
    await expect(page.getByRole("heading", { name: "Mon profil" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Testeur E2E").first()).toBeVisible();
    await expect(page.getByText("E-mail confirmé")).toBeVisible();
    if (!isMobile) {
      await expect(page.getByRole("banner").getByRole("button", { name: /Testeur E2E/ })).toBeVisible();
    }

    const exported = await page.request.get("/profil/export");
    expect(exported.status()).toBe(200);
    expect(exported.headers()["content-disposition"]).toContain("attachment");
    const data = (await exported.json()) as { compte: { email: string }; consentements: unknown[] };
    expect(data.compte.email).toBe(email);
    expect(data.consentements.length).toBeGreaterThanOrEqual(2);

    await page.getByRole("button", { name: "Se déconnecter" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/$/, { timeout: LOGIN_TIMEOUT });
    await page.goto("/profil");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("le nom affiché se modifie et se valide", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(email!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password!);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profil$/, { timeout: LOGIN_TIMEOUT });

    const name = page.getByLabel(/Nom affiché/);
    await name.fill("A");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Votre nom doit contenir au moins 2 caractères.")).toBeVisible();
    await name.fill("Testeur E2E");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Profil enregistré.")).toBeVisible();
  });
});

test.describe("Formulaires de compte (sans envoi d'e-mail)", () => {
  test("l'inscription explique chaque erreur", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/inscription");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("Votre nom doit contenir au moins 2 caractères.")).toBeVisible();
    await expect(page.getByText("Indiquez votre adresse e-mail.")).toBeVisible();
    await expect(page.getByText(/Le mot de passe doit contenir au moins 10 caractères/)).toBeVisible();
    await expect(page.getByText(/accepter les conditions d’utilisation/)).toBeVisible();
  });

  test("les règles du mot de passe se cochent en direct", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/inscription");
    const rules = page.getByRole("list", { name: "Règles du mot de passe" });
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill("abc");
    await expect(rules.getByText("Au moins une lettre")).toContainText("respectée");
    await expect(rules.getByText("10 caractères minimum")).toContainText("non respectée");
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill("abcdefghij1");
    await expect(rules.getByText("Au moins un chiffre")).toContainText("respectée");
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(page.getByRole("textbox", { name: "Mot de passe", exact: true })).toHaveAttribute("type", "text");
  });

  test("un nouveau mot de passe sans lien valide est refusé proprement", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/mot-de-passe/nouveau");
    await expect(page.getByText("Lien expiré")).toBeVisible();
    await expect(page.getByRole("link", { name: "Demander un nouveau lien" })).toBeVisible();
  });

  test("un lien de confirmation invalide renvoie vers la connexion avec une explication", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/auth/confirmation?token_hash=faux&type=email");
    await expect(page).toHaveURL(/\/connexion\?erreur=lien/);
    await expect(page.getByText("Lien invalide ou expiré")).toBeVisible();
  });

  test("les pages légales sont accessibles et signalées provisoires", async ({ page }) => {
    for (const path of ["/conditions-utilisation", "/confidentialite", "/mentions-legales"]) {
      await page.goto(path);
      await expect(page.getByText("Document provisoire")).toBeVisible();
    }
  });
});
