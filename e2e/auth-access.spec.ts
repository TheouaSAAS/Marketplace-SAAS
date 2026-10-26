import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { HAS_DATABASE, NO_DATABASE } from "./env";
import { adminFetch, deleteTestUser } from "./test-accounts";
import { passSecondFactor, signInAs } from "./sign-in";

const NETWORK = 20_000;

test.describe("Connexion et inscription", () => {
  test("la connexion présente la marque, le slogan et les liens utiles", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connexion");
    await expect(page.getByRole("main").getByText("« Votre ville, mille opportunités »")).toBeVisible();
    await expect(page.getByRole("link", { name: "Carrefour des Possibles — accueil" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Créer un compte" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à l’accueil" })).toBeVisible();
    // Sans base, le formulaire laisse place à un message « comptes indisponibles » (consultation intacte).
    if (HAS_DATABASE) await expect(page.getByRole("link", { name: "Mot de passe oublié ?" })).toBeVisible();
    else await expect(page.getByText("Comptes momentanément indisponibles")).toBeVisible();
  });

  test("l'inscription propose deux profils et adapte les champs", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/inscription");
    const profiles = page.getByRole("group", { name: "Type de profil" });
    await expect(profiles.getByRole("radio")).toHaveCount(2);
    await expect(profiles.getByRole("radio", { name: /Profil utilisateur/ })).toBeChecked();
    await expect(page.getByText(/administrat/i)).toHaveCount(0);
    await expect(page.getByLabel("Nom de l’activité")).toHaveCount(0);

    await profiles.getByRole("radio", { name: /Profil professionnel/ }).check();
    await expect(page.getByLabel("Nom de l’activité")).toBeVisible();
    await expect(page.getByLabel("Secteur d’activité").locator("option")).not.toHaveCount(1);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("Indiquez le nom de votre activité.")).toBeVisible({ timeout: NETWORK });
    await expect(page.getByText("Choisissez le secteur de votre activité.")).toBeVisible();
    // Le choix est conservé après l'erreur.
    await expect(profiles.getByRole("radio", { name: /Profil professionnel/ })).toBeChecked();
  });

  test("une adresse non confirmée ne se connecte pas et peut redemander l'e-mail", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const secret = process.env.SUPABASE_SECRET_KEY!;
    const email = `e2e-${randomBytes(6).toString("hex")}@test.invalid`;
    const password = `E2e${randomBytes(9).toString("hex")}`;
    // Compte en attente de confirmation (aucun e-mail envoyé : créé par l'API d'administration).
    const created = await adminFetch(url, secret, "/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: false }) });
    expect(created.ok).toBe(true);
    const { id } = (await created.json()) as { id: string };
    try {
      await page.goto("/connexion");
      await page.getByLabel("Adresse e-mail").fill(email);
      await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page.getByText(/Votre adresse e-mail n’est pas encore confirmée/)).toBeVisible({ timeout: NETWORK });
      await expect(page).toHaveURL(/\/connexion/);
      await expect(page.getByRole("button", { name: "Renvoyer l’e-mail de confirmation" })).toBeVisible();
      // Les espaces protégés restent fermés.
      await page.goto("/tableau-de-bord");
      await expect(page).toHaveURL(/\/connexion\?suivant=/, { timeout: NETWORK });
    } finally {
      await deleteTestUser(url, secret, id);
    }
  });

  test("un lien de confirmation expiré propose un nouvel e-mail", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/connexion?erreur=lien");
    await expect(page.getByText("Lien invalide, expiré ou déjà utilisé")).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail du compte")).toBeVisible();
    await expect(page.getByRole("button", { name: "Renvoyer l’e-mail de confirmation" })).toBeVisible();
  });
});

test.describe("Accès à l'administration", () => {
  test("sans session, l'administration mène à sa propre connexion, clairement signalée", async ({ page }) => {
    await page.goto("/admin/signalements");
    await expect(page).toHaveURL(/\/admin\/connexion\?suivant=%2Fadmin%2Fsignalements/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connexion à l’administration");
    await expect(page.getByText("Administration — accès réservé à l’équipe")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("un membre sans rôle d'administration est refusé et n'en voit rien", async ({ page }, testInfo) => {
    test.skip(!HAS_DATABASE || !process.env.E2E_USER2_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    await page.goto("/admin/connexion");
    await page.getByLabel("Adresse e-mail professionnelle").fill(process.env.E2E_USER2_EMAIL!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env.E2E_USER2_PASSWORD!);
    await page.getByRole("button", { name: "Se connecter à l’administration" }).click();
    await expect(page.getByText(/Ce compte n’a pas accès à l’administration/)).toBeVisible({ timeout: NETWORK });
    await expect(page).toHaveURL(/\/admin\/connexion/);
    // La session n'est pas laissée ouverte : l'administration redemande la connexion.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/, { timeout: NETWORK });
  });

  test("un mauvais mot de passe reçoit une réponse générique", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/admin/connexion");
    await page.getByLabel("Adresse e-mail professionnelle").fill("inconnu-zqe2e@test.invalid");
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill("mauvais-mot-de-passe-1");
    await page.getByRole("button", { name: "Se connecter à l’administration" }).click();
    await expect(page.getByText("Adresse e-mail ou mot de passe incorrect.")).toBeVisible({ timeout: NETWORK });
  });

  test("un administrateur passe par le second facteur avant le tableau de bord", async ({ page }, testInfo) => {
    test.skip(!HAS_DATABASE || !process.env.E2E_ADMIN_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    test.setTimeout(120_000);
    await page.goto("/admin/connexion?suivant=%2Fadmin%2Fcomptes");
    await page.getByLabel("Adresse e-mail professionnelle").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Se connecter à l’administration" }).click();
    await expect(page).toHaveURL(/\/admin\/verification\?suivant=%2Fadmin%2Fcomptes/, { timeout: NETWORK });
    // Avant le second facteur, aucune page d'administration ne s'ouvre.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/verification/, { timeout: NETWORK });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second facteur");
    if (await page.getByText("Vérification momentanément indisponible").isVisible()) await page.reload();
    await page.getByLabel("Code à 6 chiffres").fill("000000");
    await page.getByRole("button", { name: /Vérifier et ouvrir/ }).click();
    await expect(page.getByText(/Code incorrect ou expiré/)).toBeVisible({ timeout: NETWORK });
    await passSecondFactor(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Administration");
  });

  test("l'administrateur connecté par la page publique est conduit au second facteur", async ({ page }, testInfo) => {
    test.skip(!HAS_DATABASE || !process.env.E2E_ADMIN_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    test.setTimeout(120_000);
    await signInAs(page, "E2E_ADMIN");
    await page.goto("/admin/comptes");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comptes et organisations");
  });
});
