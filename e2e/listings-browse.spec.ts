import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;

/** Accès direct à la base par la clé secrète (préparation et nettoyage des données de test « Zqe2e »). */
async function service<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=representation", "User-Agent": "e2e-annonces", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Sur mobile, les filtres sont repliés sous « Filtres et tri ». */
async function openFilters(page: Page) {
  // Les résultats arrivent en flux : attendre le formulaire avant de regarder s'il est replié.
  const summary = page.locator("summary", { hasText: "Filtres et tri" });
  await summary.waitFor({ state: "attached", timeout: NETWORK });
  // Hydratation terminée : un clic plus tôt peut être annulé par le rendu du client.
  await page.waitForLoadState("networkidle").catch(() => {});
  if (!(await summary.isVisible())) return;
  await expect(async () => {
    if (!(await page.locator("details[open]", { has: summary }).count())) await summary.click();
    await expect(page.getByLabel("Trier par")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: NETWORK });
}

test.describe("Toutes les annonces", () => {
  test("sans base, la page reste explicite", async ({ page }) => {
    test.skip(HAS_DATABASE, "Base configurée : état nominal testé ci-dessous");
    const response = await page.goto("/annonces");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Toutes les annonces");
    await expect(page.getByText("Annonces indisponibles")).toBeVisible();
  });

  test("parcourt les rubriques jusqu'à une sous-catégorie, avec des filtres adaptés", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    const response = await page.goto("/annonces");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Toutes les annonces");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const rubriques = page.getByRole("group", { name: "Rubriques" });
    await expect(rubriques.getByRole("link", { name: "Biens et objets" })).toBeVisible();
    // Les offres d'emploi ont leur rubrique : pas de pastille ici.
    await expect(rubriques.getByRole("link", { name: "Emploi et stages" })).toHaveCount(0);

    await rubriques.getByRole("link", { name: "Véhicules", exact: true }).click();
    await expect(page).toHaveURL(/\/annonces\?categorie=vehicules$/, { timeout: NETWORK });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Véhicules");
    await page.getByRole("group", { name: "Sous-rubriques de Véhicules" }).getByRole("link", { name: "Voitures", exact: true }).click();
    await expect(page).toHaveURL(/\/annonces\?categorie=voitures$/, { timeout: NETWORK });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Voitures");
    await expect(page.getByRole("navigation", { name: "Fil d’Ariane" }).getByRole("link", { name: "Véhicules" })).toBeVisible();

    await openFilters(page);
    await expect(page.getByLabel("Carburant")).toBeVisible();
    await expect(page.getByRole("group", { name: /Kilométrage/ })).toBeVisible();
    await page.getByLabel("Carburant").selectOption("diesel");
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page).toHaveURL(/categorie=voitures.*carburant=diesel/, { timeout: NETWORK });

    // Un meuble n'a ni kilométrage ni carburant, mais un état.
    await page.goto("/annonces?categorie=meubles");
    await openFilters(page);
    await expect(page.getByLabel("État", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Carburant")).toHaveCount(0);
    await expect(page.getByRole("option", { name: "À réparer" })).toHaveCount(1);
  });

  test("retire de l'adresse les filtres inconnus ou étrangers à la catégorie", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/annonces?categorie=meubles&kilometrage_max=1000&inconnu=x&page=1&tri=recent");
    await expect(page).toHaveURL(/\/annonces\?categorie=meubles$/, { timeout: NETWORK });
    await page.goto("/annonces?categorie=rubrique-inexistante");
    await expect(page).toHaveURL(/\/annonces$/, { timeout: NETWORK });
  });

  test("recherche, ouvre une fiche et retrouve ses critères au retour", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/annonces?q=exemple&tri=prix_asc");
    const results = page.getByRole("list", { name: "Annonces" });
    await expect(results).toBeVisible({ timeout: NETWORK });
    const first = results.getByRole("heading", { level: 3 }).first().getByRole("link");
    const title = (await first.textContent()) ?? "";
    expect(title).toContain("Exemple");
    // Chaque carte propose le favori ; sans compte, il mène à la connexion.
    await expect(results.getByRole("button", { name: /Ajouter aux favoris/ }).first()).toBeVisible();
    await first.click();
    await expect(page).toHaveURL(/\/annonces\/exemple-[a-z-]+$/, { timeout: NETWORK });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title, { timeout: NETWORK });
    await page.goBack();
    await expect(page).toHaveURL(/\/annonces\?q=exemple&tri=prix_asc$/, { timeout: NETWORK });
    await expect(page.getByRole("searchbox", { name: "Mots-clés" })).toHaveValue("exemple");
  });

  test("propose un état vide utile", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/annonces?q=zzzaucuneannoncezzz");
    await expect(page.getByText("Aucune annonce ne correspond à ces critères")).toBeVisible({ timeout: NETWORK });
    await page.getByRole("link", { name: "Retirer les filtres" }).click();
    await expect(page).toHaveURL(/\/annonces$/, { timeout: NETWORK });
  });

  test("ne déborde pas horizontalement", async ({ page }) => {
    for (const path of ["/annonces", "/annonces?categorie=voitures"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("une annonce publiée, modifiée puis retirée s'actualise sans recharger la page", async ({ page }, testInfo) => {
    test.skip(!HAS_DATABASE || !process.env.E2E_USER_ID, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Données partagées : un seul projet les modifie");
    test.setTimeout(120_000);
    const token = `zqe2elive${randomBytes(3).toString("hex")}`;
    const slug = `${token}-bien`;
    try {
      await page.goto(`/annonces?q=${token}`);
      await expect(page.getByText("Aucune annonce ne correspond à ces critères")).toBeVisible({ timeout: NETWORK });
      await expect(page.locator("[data-live]")).toHaveAttribute("data-live", "live", { timeout: NETWORK });
      await expect(page.getByText("Mise à jour en direct")).toBeVisible();
      // Le marqueur distingue la page affichée d'un rechargement complet.
      await page.evaluate(() => Object.assign(window, { zqSansRechargement: true }));

      const [category] = await service<{ id: string }[]>("/rest/v1/categories?slug=eq.meubles&select=id");
      const [city] = await service<{ id: string }[]>("/rest/v1/cities?is_default=eq.true&select=id");
      await service("/rest/v1/listings", {
        method: "POST",
        body: JSON.stringify({
          owner_id: process.env.E2E_USER_ID,
          slug,
          title: `Zqe2e Armoire ${token}`,
          description: "Annonce de test automatique, supprimée en fin de test.",
          category_id: category!.id,
          city_id: city!.id,
          status: "published",
          location: "SRID=4326;POINT(-6.63 4.75)",
          location_precision: "exact",
          price: 45000,
          availability_status: "available",
        }),
      });
      const card = page.getByRole("list", { name: "Annonces" }).getByRole("listitem").filter({ hasText: token });
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card.getByText("Disponible", { exact: true })).toBeVisible();

      await service(`/rest/v1/listings?slug=eq.${slug}`, { method: "PATCH", body: JSON.stringify({ availability_status: "unavailable" }) });
      await expect(card.getByText("Non disponible", { exact: true })).toBeVisible({ timeout: 30_000 });

      await service(`/rest/v1/listings?slug=eq.${slug}`, { method: "PATCH", body: JSON.stringify({ status: "archived" }) });
      await expect(page.getByText("Aucune annonce ne correspond à ces critères")).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => (window as unknown as { zqSansRechargement?: boolean }).zqSansRechargement)).toBe(true);
    } finally {
      await service(`/rest/v1/listings?slug=eq.${slug}`, { method: "DELETE" }).catch(() => {});
    }
  });
});
