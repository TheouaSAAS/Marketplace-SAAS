import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";
import { signInAs } from "./sign-in";

const NETWORK = 20_000;
const ADMIN_HOOD = "zone-industrielle";
// Petit carré à l'intérieur de la ville (test seulement, retiré ensuite).
const SQUARE = '{"type":"Polygon","coordinates":[[[-6.640,4.745],[-6.636,4.745],[-6.636,4.749],[-6.640,4.749],[-6.640,4.745]]]}';

/** Remet le quartier sans périmètre et supprime les brouillons de test (clé secrète). */
async function resetBoundary(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const headers = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "User-Agent": "e2e-quartiers" };
  const rows = (await (await fetch(`${url}/rest/v1/neighborhoods?slug=eq.${slug}&select=id`, { headers })).json()) as { id: string }[];
  for (const { id } of rows) {
    await fetch(`${url}/rest/v1/neighborhood_boundaries?neighborhood_id=eq.${id}`, { method: "DELETE", headers });
    await fetch(`${url}/rest/v1/neighborhoods?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ boundary: null, boundary_validated_at: null }) });
  }
}

test.describe("Quartiers", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("la liste est alphabétique, neutre et signale l'absence de périmètre", async ({ page }) => {
    await page.goto("/quartiers");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quartiers de San Pedro");
    await expect(page.getByText(/ne classe pas les quartiers et ne les qualifie pas/)).toBeVisible();
    const names = await page.getByRole("main").locator("li a span.text-lg").allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "fr")));
    await expect(page.getByText("Sans périmètre validé").first()).toBeVisible();
  });

  test("une fiche ne montre que les contenus rattachés et renvoie vers les domaines filtrés", async ({ page, isMobile }) => {
    await page.goto("/quartiers/cite");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cité");
    await expect(page.getByText(/Pas de périmètre validé/).first()).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Rubriques du quartier" });
    for (const label of ["À découvrir", "Logement", "Services", "Commerces", "Tourisme", "Carte"]) await expect(tabs.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    await tabs.getByRole("link", { name: /Commerces/ }).click();
    await expect(page).toHaveURL(/\/quartiers\/cite\?onglet=commerces$/);
    const all = page.getByRole("link", { name: "Tout voir et filtrer dans ce quartier" });
    if ((await all.count()) > 0) {
      await expect(all).toHaveAttribute("href", "/commerces?quartier=cite");
    } else {
      await expect(page.getByText("Rien de rattaché pour l’instant")).toBeVisible();
    }
    await tabs.getByRole("link", { name: "Carte" }).click();
    await expect(page.getByText("Pas de périmètre validé", { exact: true })).toBeVisible();
    test.skip(isMobile, "Vérification du filtre faite une fois");
    await page.goto("/tourisme?quartier=cite");
    await expect(page.getByLabel("Quartier", { exact: true })).toHaveValue("cite");
  });

  test("périmètre : brouillon, validation, carte publique, retrait tracé", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Référentiel partagé : un seul projet le modifie");
    test.setTimeout(120_000);
    await resetBoundary(ADMIN_HOOD);
    try {
      const page = await (await browser.newContext()).newPage();
      await signInAs(page, "E2E_ADMIN");
      await page.goto("/admin");
      await page.getByRole("link", { name: "Gérer les quartiers et leurs périmètres" }).click();
      await page.getByRole("link", { name: "Zone industrielle" }).click();

      await page.getByText("Proposer un périmètre").click();
      await page.getByLabel("Périmètre (GeoJSON)").fill('{"type":"LineString","coordinates":[[-6.64,4.745],[-6.63,4.75]]}');
      await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
      await expect(page.getByText("Le périmètre doit être un polygone (Polygon ou MultiPolygon).")).toBeVisible({ timeout: NETWORK });
      await page.getByLabel("Périmètre (GeoJSON)").fill(SQUARE);
      await page.getByLabel("Note (facultatif)").fill("Test automatique");
      await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
      await expect(page.getByText(/Brouillon enregistré/)).toBeVisible({ timeout: NETWORK });

      await page.reload();
      const draft = page.getByRole("listitem").filter({ hasText: "Note : Test automatique" });
      await expect(draft.getByRole("figure", { name: /Brouillon de périmètre/ })).toBeVisible();
      await draft.getByRole("button", { name: "Valider et publier" }).click();
      // La page se met à jour : le brouillon passe « Publié », avec la date de décision.
      await expect(draft.getByText("Publié", { exact: true })).toBeVisible({ timeout: NETWORK });
      await expect(draft.getByText(/^Décision le/)).toBeVisible();

      await page.goto(`/quartiers/${ADMIN_HOOD}?onglet=carte`);
      await expect(page.getByRole("figure", { name: "Périmètre validé du quartier Zone industrielle" })).toBeVisible({ timeout: NETWORK });

      await page.goto(`/admin/quartiers/${ADMIN_HOOD}`);
      await page.getByText("Retirer le périmètre publié").first().click();
      await page.getByLabel("Motif du retrait").fill("Fin du test automatique");
      await page.getByRole("button", { name: "Retirer le périmètre publié" }).click();
      // La page se met à jour : plus de périmètre publié, la version reste dans l'historique.
      const version = page.getByRole("listitem").filter({ hasText: "Note : Test automatique" });
      await expect(version.getByText("Remplacé", { exact: true })).toBeVisible({ timeout: NETWORK });
      await expect(page.getByText("Retirer le périmètre publié")).toHaveCount(0);
    } finally {
      await resetBoundary(ADMIN_HOOD);
    }
  });
});

test("sans base, les quartiers l'indiquent clairement", async ({ page }) => {
  test.skip(HAS_DATABASE, "Base configurée");
  await page.goto("/quartiers");
  await expect(page.getByText("Quartiers indisponibles")).toBeVisible();
});
