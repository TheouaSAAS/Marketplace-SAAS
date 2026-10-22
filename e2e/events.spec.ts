import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;
const DEMO = "/evenements/exemple-evenement";

async function asUser(browser: Browser, prefix: "E2E_USER" | "E2E_USER2" | "E2E_ADMIN"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(process.env[`${prefix}_EMAIL`]!);
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env[`${prefix}_PASSWORD`]!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
  return page;
}

/** Supprime l'événement de test (clé secrète), même si le test échoue en route. */
async function deleteEvents(titlePrefix: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  await fetch(`${url}/rest/v1/events?title=like.${encodeURIComponent(titlePrefix)}*`, {
    method: "DELETE",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "User-Agent": "e2e-evenements" },
  }).catch(() => undefined);
}

/** « AAAA-MM-JJTHH:MM » dans N jours à 18 h (heure de San Pedro = UTC). */
function inDays(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return `${date.toISOString().slice(0, 10)}T18:00`;
}

test.describe("Événements", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("l'agenda liste les événements à venir et propose un calendrier", async ({ page }) => {
    await page.goto("/evenements");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Événements à San Pedro");
    await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Calendrier" }).click();
    await expect(page).toHaveURL(/\/evenements\?vue=calendrier$/, { timeout: NETWORK });
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("link", { name: "Mois suivant" }).click();
    await expect(page).toHaveURL(/\/evenements\?vue=calendrier&mois=\d{4}-\d{2}$/, { timeout: NETWORK });
    await expect(page.getByRole("link", { name: "Mois précédent" })).toBeVisible();
  });

  test("les filtres de période et de prix restent dans l'adresse", async ({ page }) => {
    await page.goto("/evenements");
    const form = page.getByRole("form", { name: "Filtres de l’agenda" });
    await form.getByLabel("Quand").selectOption("weekend");
    await form.getByLabel("Prix").selectOption("gratuit");
    await form.getByRole("button", { name: "Appliquer" }).click();
    await expect(page).toHaveURL(/\/evenements\?quand=weekend&prix=gratuit$/, { timeout: NETWORK });
  });

  test("la fiche donne la date, l'agenda à télécharger et le signalement", async ({ page }) => {
    const response = await page.goto(DEMO);
    test.skip(response?.status() !== 200 || (await page.getByText("Exemple de démonstration").count()) === 0, "Démonstration désactivée");
    await expect(page.getByText("Ajouter à mon agenda")).toBeVisible();
    const ics = await page.request.get(`${DEMO}/agenda.ics`);
    expect(ics.status()).toBe(200);
    expect(ics.headers()["content-type"]).toContain("text/calendar");
    expect(await ics.text()).toContain("BEGIN:VEVENT");
    await expect(page.getByText("Signaler cet événement")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Source et vérification" })).toBeVisible();
  });

  test("proposition, modération, favori, annulation visible et notifiée", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_USER2_EMAIL || !process.env.E2E_USER_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(180_000);
    const title = `Zqe2e ${randomBytes(3).toString("hex")} tournoi de test`;
    try {
      const organizer = await asUser(browser, "E2E_USER2");
      await organizer.goto("/evenements/proposer");
      const field = (label: string) => organizer.getByLabel(label, { exact: true }).filter({ visible: true });
      await field("Titre").fill(title);
      await field("Description").fill("Événement de test automatique, à ignorer : il sera supprimé.");
      await field("Catégorie").selectOption({ label: "Sport" });
      await field("Organisateur").fill("Testeur E2E");
      await field("Début").fill(inDays(5));
      await organizer.getByRole("button", { name: "Proposer l’événement" }).click();
      await expect(organizer).toHaveURL(/\/evenements\/mes-evenements\?propose=1$/, { timeout: NETWORK });
      const mine = organizer.getByRole("listitem").filter({ hasText: title });
      await expect(mine.getByText("En attente")).toBeVisible();

      const moderator = await asUser(browser, "E2E_ADMIN");
      await moderator.getByRole("link", { name: "Modérer les événements" }).click();
      const pending = moderator.getByRole("listitem").filter({ hasText: title });
      await pending.getByRole("button", { name: "Publier" }).click();
      await expect(moderator.getByText(/Événement publié : l’organisateur est notifié/)).toBeVisible({ timeout: NETWORK });

      await organizer.reload();
      const published = organizer.getByRole("listitem").filter({ hasText: title });
      const detail = await published.getByRole("link", { name: title }).getAttribute("href");
      expect(detail).toMatch(/^\/evenements\//);

      const fan = await asUser(browser, "E2E_USER");
      await fan.goto(detail!);
      await fan.getByRole("button", { name: "Ajouter aux favoris" }).click();
      await expect(fan.getByRole("button", { name: "Dans mes favoris" })).toBeVisible({ timeout: NETWORK });

      await published.getByText("Reporter ou annuler").click();
      await published.getByLabel("Changement").selectOption("annuler");
      await published.getByLabel("Motif affiché au public").fill("Test automatique : annulé");
      await published.getByRole("button", { name: "Enregistrer le changement" }).click();
      // La liste se met à jour : l'événement reste publié, marqué « Annulé ».
      await expect(published.getByText("Annulé", { exact: true })).toBeVisible({ timeout: NETWORK });
      await expect(published.getByText("Publiée", { exact: true })).toBeVisible();

      await fan.reload();
      await expect(fan.getByRole("alert").filter({ hasText: "Événement annulé" })).toContainText("Test automatique : annulé");
      await fan.goto("/profil");
      await expect(fan.getByRole("link", { name: `Événement annulé : ${title}` })).toBeVisible();
    } finally {
      await deleteEvents("Zqe2e ");
    }
  });
});

test("sans base, l'agenda l'indique clairement", async ({ page }) => {
  test.skip(HAS_DATABASE, "Base configurée");
  await page.goto("/evenements");
  await expect(page.getByText("Agenda indisponible")).toBeVisible();
});
