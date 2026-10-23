import { expect, test, type Browser, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;
const SHOWCASE = "/lieux/exemple-restaurant";
const CLAIMED = "/lieux/exemple-quincaillerie";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
}

async function asUser(browser: Browser, prefix: "E2E_USER" | "E2E_USER2" | "E2E_ADMIN") {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, process.env[`${prefix}_EMAIL`]!, process.env[`${prefix}_PASSWORD`]!);
  return page;
}

/** Remet la vitrine de démonstration sans gérant (clé secrète), même si le test échoue en route. */
async function releaseShowcase(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  await fetch(`${url}/rest/v1/places?slug=eq.${slug}`, {
    method: "PATCH",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "User-Agent": "e2e-shops" },
    body: JSON.stringify({ manager_id: null }),
  });
}

test.describe("Commerces", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("les vues spécialisées et les filtres restent dans l'adresse, y compris sur mobile", async ({ page, isMobile }) => {
    await page.goto("/commerces");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Commerces de proximité");
    const views = page.getByRole("navigation", { name: "Types de commerces" });
    for (const name of ["Restaurants et gastronomie", "Alimentation", "Quincaillerie et matériaux", "Auto, moto et pièces"]) {
      await expect(views.getByRole("link", { name })).toBeVisible();
    }
    await views.getByRole("link", { name: "Alimentation" }).click();
    await expect(page).toHaveURL(/\/commerces\?type=alimentation$/);

    if (isMobile) await page.getByText("Filtres et tri", { exact: true }).first().click();
    await page.getByLabel("Livraison").check();
    await page.getByLabel("Parking").check();
    await page.getByRole("button", { name: "Appliquer" }).click();
    // Adresse canonique : services triés et regroupés.
    await expect(page).toHaveURL(/\/commerces\?type=alimentation&services=livraison%2Cparking$/);
    await page.getByText("Pourquoi cet ordre ?").click();
    await expect(page.getByText(/ils ne changent pas cet ordre/)).toBeVisible();
  });

  test("une vitrine sans horaires vérifiés ne les invente pas et propose la revendication", async ({ page }) => {
    const response = await page.goto(SHOWCASE);
    test.skip(response?.status() !== 200 || (await page.getByText("Exemple de démonstration").count()) === 0, "Démonstration désactivée");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Exemple — Restaurant/);
    await expect(page.getByText(/Horaires non renseignés/)).toBeVisible();
    await expect(page.getByText(/Position approximative/)).toBeVisible();
    await expect(page.getByText(/La messagerie sera disponible quand l’exploitant aura revendiqué/)).toBeVisible();
    await expect(page.getByText("Signaler cette vitrine")).toBeVisible();
    await page.getByText("Vous êtes l’exploitant ? Revendiquer cette vitrine").click();
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByText("Indiquez votre lien avec ce commerce.")).toBeVisible({ timeout: NETWORK });
  });

  test("une carte de commerce mène à sa vitrine", async ({ page }) => {
    await page.goto("/commerces?type=restaurants-gastronomie");
    const link = page.getByRole("link", { name: /Exemple — Restaurant/ }).first();
    test.skip((await link.count()) === 0, "Démonstration désactivée");
    await link.click();
    await expect(page).toHaveURL(/\/lieux\/exemple-restaurant$/);
  });

  test("revendication validée par l'équipe, puis message d'un client à l'exploitant", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_USER2_EMAIL || !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_USER_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(180_000);
    try {
      const owner = await asUser(browser, "E2E_USER2");
      const response = await owner.goto(CLAIMED);
      test.skip(response?.status() !== 200 || (await owner.getByText("Exemple de démonstration").count()) === 0, "Démonstration désactivée");
      // Favori et « j'aime » au passage.
      await owner.getByRole("button", { name: "Ajouter aux favoris" }).click();
      await expect(owner.getByRole("button", { name: "Dans mes favoris" })).toBeVisible({ timeout: NETWORK });
      await owner.getByRole("button", { name: /^J’aime/ }).click();
      await expect(owner.getByRole("button", { name: /^Je n’aime plus/ })).toBeVisible({ timeout: NETWORK });

      await owner.getByText("Vous êtes l’exploitant ? Revendiquer cette vitrine").click();
      // Une demande déjà en attente (nouvelle tentative du test) n'est pas renvoyée.
      if ((await owner.getByText("Demande en cours d’examen").count()) === 0) {
        await owner.getByLabel("Votre lien avec cet établissement").selectOption("gerant");
        await owner.getByLabel("Présentez-vous").fill("Test automatique : je gère cette quincaillerie, à ignorer.");
        await owner.getByLabel("Élément vérifiable").fill("RCCM de test");
        await owner.getByLabel("Téléphone (pour l’équipe seulement)").fill("0700000000");
        await owner.getByRole("button", { name: "Envoyer la demande" }).click();
      }
      // La page se met à jour : la demande apparaît « en cours d'examen ».
      await expect(owner.getByText("Demande en cours d’examen")).toBeVisible({ timeout: NETWORK });

      const admin = await asUser(browser, "E2E_ADMIN");
      await admin.goto("/admin");
      await admin.getByRole("link", { name: "Examiner les revendications (vitrines, pages pro)" }).click();
      const claim = admin.getByRole("listitem").filter({ hasText: "Test automatique : je gère cette quincaillerie" });
      await expect(claim).toBeVisible({ timeout: NETWORK });
      await claim.getByRole("button", { name: "Valider" }).click();
      await expect(admin.getByText(/Revendication validée/)).toBeVisible({ timeout: NETWORK });

      await owner.goto("/profil");
      await expect(owner.getByText(/Exemple — Quincaillerie/).first()).toBeVisible();
      // Ligne de la revendication dans « Mes revendications » (la notification dit aussi « validée »).
      await expect(owner.getByText(/· Validée$/)).toBeVisible();

      const client = await asUser(browser, "E2E_USER");
      await client.goto(CLAIMED);
      await expect(client.getByText("Gérée par l’exploitant")).toBeVisible({ timeout: NETWORK });
      await client.getByLabel("Votre message à l’exploitant").fill("Message de test automatique, à ignorer.");
      await client.getByRole("button", { name: "Envoyer par la messagerie" }).click();
      await expect(client).toHaveURL(/\/messages\/[0-9a-f-]{36}$/, { timeout: NETWORK });
      await expect(client.getByText("À propos de la vitrine")).toBeVisible();
    } finally {
      await releaseShowcase("exemple-quincaillerie");
    }
  });
});

test("sans base, l'annuaire des commerces l'indique clairement", async ({ page }) => {
  test.skip(HAS_DATABASE, "Base configurée");
  await page.goto("/commerces");
  await expect(page.getByText("Annuaire indisponible")).toBeVisible();
});
