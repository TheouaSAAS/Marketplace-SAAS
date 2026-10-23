import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

// Compte administrateur dédié (E2E_ADMIN), créé et promu par global-setup.
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const NETWORK = 20_000;
const KEYWORD = "zqxe2eclim";

/** Remet les mots-clés d'origine par la clé secrète, même si le test échoue en route. */
async function restoreKeywords(keywords: string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  await fetch(`${url}/rest/v1/categories?slug=eq.climatisation`, {
    method: "PATCH",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "User-Agent": "e2e-admin" },
    body: JSON.stringify({ keywords }),
  });
}

test.describe("Administration du référentiel", () => {
  test("sans compte, la page des catégories passe par la connexion", async ({ page }) => {
    await page.goto("/admin/categories");
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fadmin%2Fcategories/);
  });

  test("un administrateur modifie les mots-clés d'un métier, aussitôt pris en compte par la recherche", async ({ page }, testInfo) => {
    test.skip(!HAS_DATABASE || !email || !password, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Référentiel partagé : un seul projet le modifie");
    test.setTimeout(120_000);
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(email!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password!);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
    await page.goto("/admin");
    await page.getByRole("link", { name: "Gérer les catégories et métiers" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catégories");

    const row = page.getByRole("listitem").filter({ has: page.getByText("Climatisation et froid", { exact: true }) });
    await row.getByText("Climatisation et froid", { exact: true }).click();
    const field = row.getByLabel("Mots-clés").first();
    const original = (await field.inputValue()).split(",").map((keyword) => keyword.trim()).filter(Boolean);
    try {
      await field.fill([...original, KEYWORD].join(", "));
      await row.getByRole("button", { name: "Enregistrer" }).click();
      await expect(row.getByText(/^Enregistré/)).toBeVisible({ timeout: NETWORK });

      await page.goto(`/services?q=${KEYWORD}`);
      await expect(page.getByText("Métier reconnu : Climatisation et froid")).toBeVisible({ timeout: NETWORK });
    } finally {
      await restoreKeywords(original);
    }
  });

  test("un membre sans rôle d'administration n'y a pas accès", async ({ page }, testInfo) => {
    const member = process.env.E2E_USER2_EMAIL;
    test.skip(!HAS_DATABASE || !member, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(member!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env.E2E_USER2_PASSWORD!);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
    await page.goto("/admin/categories");
    await expect(page.getByText("Cette page est réservée aux administrateurs de la plateforme.")).toBeVisible();
    await expect(page.getByLabel("Mots-clés")).toHaveCount(0);
  });
});
