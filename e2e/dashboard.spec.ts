import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;

async function asUser(browser: Browser, prefix: "E2E_USER" | "E2E_USER2" | "E2E_ADMIN"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(process.env[`${prefix}_EMAIL`]!);
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env[`${prefix}_PASSWORD`]!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
  return page;
}

function service(path: string, init: RequestInit = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  return fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=representation", "User-Agent": "e2e-tableau-de-bord", ...(init.headers ?? {}) },
  });
}

test("le tableau de bord exige une connexion", async ({ page }) => {
  await page.goto("/tableau-de-bord/annonces");
  await expect(page).toHaveURL(/\/connexion\?suivant=%2Ftableau-de-bord%2Fannonces/, { timeout: NETWORK });
});

test.describe("Tableau de bord", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("la vue d'ensemble et la navigation tiennent sur petit écran", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_USER_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "mobile", "Vérification propre à l’affichage mobile");
    const page = await asUser(browser, "E2E_USER");
    await page.goto("/tableau-de-bord");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tableau de bord");
    const nav = page.getByRole("navigation", { name: "Tableau de bord" });
    await expect(nav.getByRole("link", { name: "Vue d’ensemble" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Confidentialité" }).click();
    await expect(page).toHaveURL(/\/tableau-de-bord\/confidentialite$/, { timeout: NETWORK });
    // Aucune barre de défilement horizontale de la page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test("confidentialité appliquée au site public, statistiques, archivage confirmé et historique", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_ID, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(180_000);
    const title = `Zqe2e ${randomBytes(3).toString("hex")} table de test`;
    try {
      // Annonce publiée de l'utilisateur de test (clé secrète : la publication suit son propre circuit, testé ailleurs).
      const [category] = (await (await service("/rest/v1/categories?slug=eq.maison-ameublement&select=id")).json()) as { id: string }[];
      const [city] = (await (await service("/rest/v1/cities?is_default=eq.true&select=id")).json()) as { id: string }[];
      const created = (await (
        await service("/rest/v1/listings", {
          method: "POST",
          body: JSON.stringify({
            owner_id: process.env.E2E_USER_ID,
            slug: `zqe2e-${randomBytes(4).toString("hex")}`,
            title,
            description: "Annonce de test automatique, à ignorer : elle sera supprimée.",
            category_id: category!.id,
            city_id: city!.id,
            status: "published",
            location: "SRID=4326;POINT(-6.6363 4.7485)",
            location_precision: "approximate",
          }),
        })
      ).json()) as { slug: string }[];
      const listingPath = `/annonces/${created[0]!.slug}`;

      const page = await asUser(browser, "E2E_USER");
      await page.goto("/tableau-de-bord/confidentialite");
      await page.getByLabel("Afficher mon nom public").uncheck();
      await page.getByLabel("Laisser les moteurs de recherche indexer mes annonces").uncheck();
      await page.getByRole("button", { name: "Enregistrer mes choix" }).click();
      await expect(page.getByText(/Préférences enregistrées : elles s’appliquent tout de suite/)).toBeVisible({ timeout: NETWORK });

      // Effet sur la page publique, vue par un visiteur.
      const visitor = await (await browser.newContext()).newPage();
      await visitor.goto(listingPath);
      await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(title, { timeout: NETWORK });
      await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(visitor.getByText("Testeur E2E", { exact: true })).toHaveCount(0);
      await expect(visitor.getByText("Membre", { exact: true }).first()).toBeVisible();

      // Mes annonces : statistiques expliquées, archivage confirmé, historique.
      await page.goto("/tableau-de-bord/annonces?statut=published");
      const item = page.getByRole("listitem").filter({ hasText: title });
      await expect(item.getByText("Vues", { exact: true })).toBeVisible();
      await item.getByRole("button", { name: "Marquer indisponible" }).click();
      await expect(item.getByText("Indisponible", { exact: true })).toBeVisible({ timeout: NETWORK });
      await item.locator("summary", { hasText: "Archiver" }).click();
      await item.getByLabel(/Je confirme : l’annonce quitte le site/).check();
      await item.getByRole("button", { name: "Archiver" }).click();
      await expect(page).toHaveURL(/statut=archived&fait=archivee/, { timeout: NETWORK });
      await expect(page.getByText(/Annonce archivée : elle a quitté le site/)).toBeVisible();
      const archived = page.getByRole("listitem").filter({ hasText: title });
      await archived.getByText("Historique").click();
      await expect(archived.getByText(/publiée → archivée/)).toBeVisible({ timeout: NETWORK });
      await expect(archived.getByText(/disponibilité : indisponible/)).toBeVisible();

      // Notifications : une catégorie coupée reste coupée.
      await page.goto("/tableau-de-bord/notifications");
      await page.getByLabel("Avis", { exact: true }).uncheck();
      await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
      await expect(page.getByText("Préférences de notification enregistrées.")).toBeVisible({ timeout: NETWORK });
      await page.reload();
      await expect(page.getByLabel("Avis", { exact: true })).not.toBeChecked();
    } finally {
      await service(`/rest/v1/listings?title=eq.${encodeURIComponent(title)}`, { method: "DELETE" });
      await service(`/rest/v1/user_preferences?user_id=eq.${process.env.E2E_USER_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ show_public_name: true, search_indexing: true, notification_channels: {} }),
      });
    }
  });
});
