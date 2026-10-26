import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";
import { signInAs } from "./sign-in";

const NETWORK = 20_000;

async function asUser(browser: Browser, prefix: "E2E_USER" | "E2E_USER2" | "E2E_ADMIN"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signInAs(page, prefix);
  return page;
}

/** Supprime les offres de test (clé secrète), même si le test échoue en route. Les candidatures suivent en cascade. */
async function deleteOffers(titlePrefix: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  await fetch(`${url}/rest/v1/listings?title=like.${encodeURIComponent(titlePrefix)}*`, {
    method: "DELETE",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "User-Agent": "e2e-emploi" },
  }).catch(() => undefined);
}

test.describe("Emploi et opportunités", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("les filtres restent dans l'adresse", async ({ page }) => {
    await page.goto("/emploi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Emploi et opportunités");
    const form = page.getByRole("form", { name: "Filtres des offres" });
    // Sur mobile, les filtres sont repliés.
    if (!(await form.isVisible())) await page.getByText("Filtres", { exact: true }).click();
    await form.getByLabel("Contrat").selectOption("cdi");
    await form.getByLabel("Lieu de travail").selectOption("partiel");
    await form.getByLabel("Type d’organisation").selectOption("association");
    await form.getByRole("button", { name: "Appliquer" }).click();
    await expect(page).toHaveURL(/\/emploi\?contrat=cdi&teletravail=partiel&organisation=association$/, { timeout: NETWORK });
  });

  test("les espaces candidat et employeur demandent une connexion", async ({ page }) => {
    for (const path of ["/emploi/mes-candidatures", "/emploi/candidatures", "/emploi/profil-candidat", "/emploi/publier"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion\?/, { timeout: NETWORK });
    }
  });

  test("une formulation discriminatoire est refusée avant publication", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_USER2_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    const employer = await asUser(browser, "E2E_USER2");
    await employer.goto("/emploi/publier");
    const field = (label: string) => employer.getByLabel(label, { exact: true }).filter({ visible: true });
    await field("Type d’annonce").selectOption({ label: "Offres d’emploi" });
    await field("Type d’organisation").selectOption("entreprise");
    await field("Intitulé").fill(`Zqe2e ${randomBytes(3).toString("hex")} caissier`);
    await field("Description").fill("Nous cherchons un caissier âgé de moins de 30 ans, disponible tout de suite.");
    await employer.getByRole("button", { name: "Envoyer l’offre en modération" }).click();
    await expect(employer.getByText(/Formulation refusée — Limite d’âge/)).toBeVisible({ timeout: NETWORK });
    await expect(employer).toHaveURL(/\/emploi\/publier$/);
  });

  test("publication, modération, candidature, décision notifiée, offre close", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_USER2_EMAIL || !process.env.E2E_USER_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(180_000);
    const title = `Zqe2e ${randomBytes(3).toString("hex")} assistant comptable`;
    try {
      const employer = await asUser(browser, "E2E_USER2");
      await employer.goto("/emploi/publier");
      const field = (label: string) => employer.getByLabel(label, { exact: true }).filter({ visible: true });
      await field("Type d’annonce").selectOption({ label: "Offres d’emploi" });
      await field("Type d’organisation").selectOption("association");
      await field("Intitulé").fill(title);
      await field("Description").fill("Offre de test automatique, à ignorer : elle sera supprimée. Tenue des comptes d’une association.");
      await field("Contrat").selectOption("cdd");
      await employer.getByRole("button", { name: "Envoyer l’offre en modération" }).click();
      await expect(employer).toHaveURL(/\/emploi\/candidatures\?publie=1$/, { timeout: NETWORK });
      const mine = employer.getByRole("listitem").filter({ hasText: title });
      await expect(mine.getByText("En attente")).toBeVisible();

      const moderator = await asUser(browser, "E2E_ADMIN");
      await moderator.goto("/admin");
      await moderator.getByRole("link", { name: "Modérer les offres d’emploi" }).click();
      await moderator.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Publier" }).click();
      await expect(moderator.getByText("Offre publiée : son auteur est notifié.")).toBeVisible({ timeout: NETWORK });

      await employer.reload();
      const published = employer.getByRole("listitem").filter({ hasText: title });
      const detail = await published.getByRole("link", { name: title }).getAttribute("href");
      expect(detail).toMatch(/^\/annonces\//);

      const candidate = await asUser(browser, "E2E_USER");
      await candidate.goto(detail!);
      await candidate.getByLabel("Votre présentation").fill("Candidature de test automatique : trois ans de tenue de comptes.");
      await candidate.getByRole("button", { name: "Envoyer ma candidature" }).click();
      await expect(candidate.getByText(/Candidature envoyée|Votre candidature est envoyée/).first()).toBeVisible({ timeout: NETWORK });

      await employer.reload();
      const received = employer.getByRole("listitem").filter({ hasText: "trois ans de tenue de comptes" });
      await received.getByLabel("Décision").selectOption("shortlisted");
      await received.getByRole("button", { name: "Enregistrer" }).click();
      await expect(received.getByText("Retenue", { exact: true })).toBeVisible({ timeout: NETWORK });

      await candidate.goto("/profil");
      await expect(candidate.getByRole("link", { name: `Candidature retenue pour la suite : ${title}` })).toBeVisible({ timeout: NETWORK });

      await published.getByRole("button", { name: "Clôturer l’offre" }).click();
      await expect(published.getByText("Close", { exact: true })).toBeVisible({ timeout: NETWORK });
      await candidate.goto(detail!);
      await expect(candidate.getByText("Cette offre est close ou expirée : elle n’accepte plus de candidature.")).toBeVisible();
    } finally {
      await deleteOffers("Zqe2e ");
    }
  });
});

test("sans base, la page emploi l'indique clairement", async ({ page }) => {
  test.skip(HAS_DATABASE, "Base configurée");
  await page.goto("/emploi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Emploi et opportunités");
});
