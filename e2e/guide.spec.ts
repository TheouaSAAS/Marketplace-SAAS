import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;
const DEMO = "/guide/se-deplacer/exemple-se-deplacer";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
}

async function asUser(browser: Browser, prefix: "E2E_USER2" | "E2E_ADMIN") {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, process.env[`${prefix}_EMAIL`]!, process.env[`${prefix}_PASSWORD`]!);
  return page;
}

/** Supprime l'article de test (clé secrète) : versions, suggestions et passages de l'assistant suivent. */
async function deleteArticle(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  await fetch(`${url}/rest/v1/guide_articles?slug=eq.${slug}`, {
    method: "DELETE",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "User-Agent": "e2e-guide" },
  });
}

test.describe("Guide pratique", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("les onze rubriques et la recherche dans le guide", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Guide pratique de San Pedro");
    const sections = page.getByRole("navigation", { name: "Rubriques" }).getByRole("link");
    await expect(sections).toHaveCount(11);
    await expect(page.getByText(/pas un conseil juridique, médical, administratif ou financier personnalisé/).first()).toBeVisible();
    await page.getByRole("searchbox", { name: "Rechercher dans le guide" }).fill("zzqqxxwwyy");
    await page.getByRole("button", { name: "Rechercher" }).click();
    await expect(page.getByText("Aucun article ne correspond")).toBeVisible({ timeout: NETWORK });
    await expect(page.getByRole("link", { name: /dans tout le site/ })).toHaveAttribute("href", "/recherche?q=zzqqxxwwyy");
  });

  test("une rubrique relie le guide aux ressources du site", async ({ page }) => {
    await page.goto("/guide/se-loger");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Se loger");
    const resources = page.getByRole("region", { name: "Sur le site" });
    await expect(resources).toBeVisible();
    await expect(resources.getByText(/^Location/)).toBeVisible();
  });

  test("un article non vérifié n'est pas présenté comme une certitude", async ({ page }) => {
    const response = await page.goto(DEMO);
    test.skip(response?.status() !== 200 || (await page.getByText("Exemple de démonstration").count()) === 0, "Démonstration désactivée");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Exemple — Se déplacer/);
    await expect(page.getByRole("region", { name: "Source et versions" }).getByText("Information à confirmer localement")).toBeVisible();
    await expect(page.getByText("Pas encore vérifié par l’équipe locale")).toBeVisible();
    // Adresse canonique : une mauvaise rubrique redirige vers la bonne.
    await page.goto("/guide/sante/exemple-se-deplacer");
    await expect(page).toHaveURL(new RegExp(`${DEMO}$`), { timeout: NETWORK });
  });

  test("rédaction versionnée, suggestion d'un lecteur et décision de l'équipe", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_USER2_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(180_000);
    const slug = `e2e-${randomBytes(4).toString("hex")}`;
    try {
      const editor = await asUser(browser, "E2E_ADMIN");
      await editor.goto("/admin");
      await editor.getByRole("link", { name: "Rédiger le guide pratique" }).click();
      await editor.getByRole("link", { name: "Nouvel article" }).click();
      await editor.getByLabel("Rubrique", { exact: true }).filter({ visible: true }).selectOption({ label: "S’installer" });
      await editor.getByLabel("Adresse (facultatif)", { exact: true }).filter({ visible: true }).fill(slug);
      await editor.getByLabel("Titre", { exact: true }).filter({ visible: true }).fill("Article de test automatique");
      await editor.getByRole("textbox", { name: "Texte", exact: true }).filter({ visible: true }).fill("## Première partie\n\nTexte de test automatique, à ignorer.\n\n## Seconde partie\n\n- un point\n- un autre point");
      await editor.getByLabel("Publication", { exact: true }).filter({ visible: true }).selectOption("published");
      await editor.getByRole("button", { name: "Enregistrer", exact: true }).filter({ visible: true }).click();
      await expect(editor.getByText("Version 1 enregistrée.")).toBeVisible({ timeout: NETWORK });

      await editor.getByRole("textbox", { name: "Texte", exact: true }).filter({ visible: true }).fill("## Première partie\n\nTexte corrigé par le test automatique.\n\n## Seconde partie\n\n- un point");
      await editor.getByLabel("Note de modification", { exact: true }).filter({ visible: true }).fill("Correction de test");
      await editor.getByRole("button", { name: "Enregistrer", exact: true }).filter({ visible: true }).click();
      await expect(editor.getByText("Version 2 enregistrée.")).toBeVisible({ timeout: NETWORK });
      await expect(editor.getByText(/Version 2 · .* — Correction de test/)).toBeVisible();

      const reader = await asUser(browser, "E2E_USER2");
      await reader.goto(`/guide/s-installer/${slug}`);
      await expect(reader.getByText("Contenu à confirmer localement")).toBeVisible();
      await expect(reader.getByRole("navigation", { name: "Sommaire" }).first()).toBeAttached();
      await reader.getByText("Historique des modifications").click();
      await expect(reader.getByText(/Version 2 · .* — Correction de test/)).toBeVisible();
      await reader.getByText("Suggérer une correction").click();
      await reader.getByLabel("Ce qui est inexact ou a changé").fill("Suggestion de test automatique, à ignorer.");
      await reader.getByRole("button", { name: "Envoyer la suggestion" }).click();
      await expect(reader.getByText(/l’équipe locale examinera votre suggestion/)).toBeVisible({ timeout: NETWORK });

      await editor.reload();
      const suggestion = editor.getByRole("listitem").filter({ hasText: "Suggestion de test automatique" });
      await expect(suggestion).toBeVisible();
      await suggestion.getByLabel("Décision").selectOption("resolved");
      await suggestion.getByRole("button", { name: "Enregistrer la décision" }).click();
      await expect(editor.getByText("Suggestion : prise en compte.")).toBeVisible({ timeout: NETWORK });
    } finally {
      await deleteArticle(slug);
    }
  });
});

test("sans base, le guide l'indique clairement", async ({ page }) => {
  test.skip(HAS_DATABASE, "Base configurée");
  await page.goto("/guide");
  await expect(page.getByText("Guide indisponible")).toBeVisible();
});
