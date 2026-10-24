import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";
import { png } from "./png";

const NETWORK = 20_000;
const PREFIX = "Zqe2e ";

async function asUser(browser: Browser, prefix: "E2E_USER" | "E2E_USER2" | "E2E_ADMIN"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(process.env[`${prefix}_EMAIL`]!);
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env[`${prefix}_PASSWORD`]!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
  return page;
}

/** Supprime les annonces d'un test et leurs photos (clé secrète), même si le test échoue en route. Préfixe propre au test : les tests tournent en parallèle. */
async function cleanup(titlePrefix: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const headers = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "User-Agent": "e2e-publication" };
  const filter = `title=like.${encodeURIComponent(titlePrefix)}*`;
  try {
    const listings = (await (await fetch(`${url}/rest/v1/listings?${filter}&select=id`, { headers })).json()) as { id: string }[];
    if (listings.length) {
      const ids = listings.map((listing) => listing.id).join(",");
      const images = (await (await fetch(`${url}/rest/v1/images?listing_id=in.(${ids})&select=storage_path,bucket`, { headers })).json()) as { storage_path: string; bucket: string }[];
      for (const bucket of ["media", "private-media"]) {
        const prefixes = images.filter((image) => image.bucket === bucket).map((image) => image.storage_path);
        if (prefixes.length) await fetch(`${url}/storage/v1/object/${bucket}`, { method: "DELETE", headers, body: JSON.stringify({ prefixes }) });
      }
    }
    await fetch(`${url}/rest/v1/listings?${filter}`, { method: "DELETE", headers });
  } catch {
    // Nettoyage au mieux : un résidu de test reste marqué « Zqe2e ».
  }
}

async function startDraft(page: Page, category = "Voitures") {
  await page.goto("/publier");
  await page.getByRole("button", { name: category, exact: true }).first().click();
  await expect(page).toHaveURL(/\/publier\/[0-9a-f-]{36}$/, { timeout: NETWORK });
  return page.url();
}

async function waitSaved(page: Page) {
  await expect(page.getByText(/Brouillon enregistré à/)).toBeVisible({ timeout: NETWORK });
}

test.describe("Publication d'une annonce", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("une description libre propose une catégorie", async ({ page }) => {
    await page.goto("/publier");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Publier une annonce");
    await page.getByLabel("Décrivez votre annonce en quelques mots").fill("Je vends ma voiture");
    await page.getByRole("button", { name: "Trouver la catégorie" }).click();
    await expect(page).toHaveURL(/\/publier\?q=Je\+vends\+ma\+voiture$/, { timeout: NETWORK });
    await expect(page.getByText("Catégories proposées (par mots-clés, à vous de choisir) :")).toBeVisible();
    await expect(page.getByRole("button", { name: /Voitures/ }).first()).toBeVisible();
  });

  test("brouillon, assistant, photo, aperçu, modération et publication", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_USER2_EMAIL || !process.env.E2E_USER_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(240_000);
    const title = `${PREFIX}${randomBytes(3).toString("hex")} Toyota Corolla 2015`;
    try {
      const author = await asUser(browser, "E2E_USER2");
      const editor = await startDraft(author);

      // Assistant (règles) : suggestions avec extrait, appliquer puis annuler.
      await author.getByLabel("Texte à analyser").fill(`${title}\nVoiture en très bon état, 120 000 km, essence, boîte automatique. Prix 4 500 000 F à débattre.`);
      await author.getByRole("button", { name: "Analyser le texte" }).click();
      const suggestions = author.getByRole("list", { name: "Suggestions" });
      await expect(suggestions.getByRole("listitem")).not.toHaveCount(0, { timeout: NETWORK });
      const priceSuggestion = suggestions.getByRole("listitem").filter({ has: author.getByText("Prix", { exact: true }) });
      await expect(priceSuggestion.getByText("Source : « 4 500 000 f »")).toBeVisible();
      for (const field of ["Titre", "Description", "Prix", "Kilométrage", "Carburant"]) {
        await suggestions.getByRole("listitem").filter({ has: author.getByText(field, { exact: true }) }).getByRole("button", { name: "Appliquer" }).click();
      }
      await expect(author.getByLabel("Titre")).toHaveValue(title);
      await expect(author.getByLabel("Prix (F CFA)")).toHaveValue("4500000");
      await priceSuggestion.getByRole("button", { name: /Annuler/ }).click();
      await expect(author.getByLabel("Prix (F CFA)")).toHaveValue("");
      await author.getByLabel("Prix (F CFA)").fill("4400000");

      // Emplacement et photo.
      await author.getByRole("application", { name: "Carte : cliquez pour placer l’annonce" }).click();
      await expect(author.getByRole("button", { name: "Retirer le repère" })).toBeVisible();
      await author.locator('input[type="file"][accept^="image"]').setInputFiles({ name: "voiture.png", mimeType: "image/png", buffer: png(1000, 750) });
      await expect(author.getByRole("list", { name: "Photos de l’annonce" }).getByRole("listitem")).toHaveCount(1, { timeout: NETWORK });
      await waitSaved(author);

      // Brouillon privé : un autre membre ne peut pas l'ouvrir.
      const curious = await asUser(browser, "E2E_USER");
      await curious.goto(editor);
      await expect(curious.getByText("Cette page est introuvable")).toBeVisible();

      // Aperçu puis soumission.
      await author.getByRole("button", { name: "Prévisualiser et soumettre" }).click();
      await expect(author).toHaveURL(/\/apercu$/, { timeout: NETWORK });
      await expect(author.getByText("Aperçu — non publié")).toBeVisible({ timeout: NETWORK });
      await expect(author.getByRole("heading", { name: "Champs issus de l’assistant (4)" })).toBeVisible();
      await author.getByLabel(/Je m’engage à respecter la charte de confiance/).check();
      await author.getByRole("button", { name: "Soumettre à la modération" }).click();
      await expect(author).toHaveURL(/\/tableau-de-bord\/annonces\?soumise=1$/, { timeout: NETWORK });
      await expect(author.getByRole("listitem").filter({ hasText: title }).getByText("En attente", { exact: true })).toBeVisible();

      // Modération : publication, photos rendues publiques.
      const moderator = await asUser(browser, "E2E_ADMIN");
      await moderator.goto("/admin");
      await moderator.getByRole("link", { name: "Modérer les annonces" }).click();
      const pending = moderator.getByRole("listitem").filter({ hasText: title }).first();
      await expect(pending.getByText(/Champs validés par l’auteur depuis l’assistant/)).toBeVisible();
      await pending.getByRole("button", { name: "Publier" }).click();
      await expect(moderator.getByText("Annonce publiée : ses photos sont en ligne et son auteur est notifié.")).toBeVisible({ timeout: NETWORK });

      await author.reload();
      await author.getByRole("listitem").filter({ hasText: title }).getByRole("link", { name: "Voir l’annonce" }).click();
      await expect(author.getByRole("heading", { level: 1 })).toHaveText(title, { timeout: NETWORK });
      const photo = author.getByRole("img", { name: `${title} — photo 1` });
      await expect(photo).toBeVisible();
      expect(decodeURIComponent((await photo.getAttribute("src")) ?? "")).toContain("/storage/v1/object/public/media/");
      await author.goto("/profil");
      await expect(author.getByRole("link", { name: `Annonce publiée : ${title}` })).toBeVisible();
    } finally {
      await cleanup(title);
    }
  });

  test("un contenu interdit ne peut pas être soumis", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_USER2_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(120_000);
    const title = `${PREFIX}${randomBytes(3).toString("hex")} pistolet`;
    try {
      const author = await asUser(browser, "E2E_USER2");
      await startDraft(author);
      await author.getByLabel("Titre").fill(title);
      await author.getByLabel("Description").fill("Vends pistolet en bon état, paiement par Orange Money avant la visite.");
      await author.getByRole("application", { name: "Carte : cliquez pour placer l’annonce" }).click();
      await waitSaved(author);
      await author.getByRole("button", { name: "Prévisualiser et soumettre" }).click();
      await expect(author).toHaveURL(/\/apercu$/, { timeout: NETWORK });
      await expect(author.getByText("Contenu à retirer avant soumission")).toBeVisible();
      await expect(author.getByText(/Armes et munitions/)).toBeVisible();
      await expect(author.getByRole("button", { name: "Soumettre à la modération" })).toHaveCount(0);
    } finally {
      await cleanup(title);
    }
  });
});

test("sans base, la publication l'indique clairement", async ({ page }) => {
  test.skip(HAS_DATABASE, "Base configurée");
  await page.goto("/publier");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Publier une annonce");
  await expect(page.getByText(/indisponibles?/).first()).toBeVisible();
});
