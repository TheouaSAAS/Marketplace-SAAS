import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const LOGIN_TIMEOUT = 20_000;

async function answerUntilPlan(page: Page) {
  await page.goto("/nouveau-arrivant/questions");
  await page.getByLabel("M’installer").check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel("Longue durée").check();
  await page.getByLabel("Location", { exact: true }).check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel("Santé").check();
  await page.getByLabel("Me déplacer").check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Voir mon plan" }).click();
  await expect(page).toHaveURL(/\/nouveau-arrivant\/plan\?motif=s_installer/);
}

test.describe("Parcours « Nouveau à San Pedro ? »", () => {
  test.beforeEach(async ({ page }) => {
    // Chaque test part d'un brouillon vide.
    await page.goto("/nouveau-arrivant");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("l'introduction rassure et lance le questionnaire", async ({ page }) => {
    await page.goto("/nouveau-arrivant");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nouveau à San Pedro ?");
    await expect(page.getByText(/ne remplace pas un conseil juridique, financier/)).toBeVisible();
    await page.getByRole("link", { name: "Commencer" }).click();
    await expect(page.getByRole("heading", { name: "Qu’est-ce qui vous amène à San Pedro ?" })).toBeVisible();
  });

  test("une étape incomplète est expliquée et le focus suit les étapes", async ({ page }) => {
    await page.goto("/nouveau-arrivant/questions");
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choisissez ce qui vous amène" })).toBeVisible();
    await page.getByLabel("Visiter").check();
    await page.getByRole("button", { name: "Suivant" }).click();
    await expect(page.getByRole("heading", { name: "Votre séjour" })).toBeFocused();
    await expect(page.getByRole("progressbar", { name: "Progression du questionnaire" })).toHaveAttribute("aria-valuenow", "2");
  });

  test("on ne peut pas choisir plus de quatre priorités", async ({ page }) => {
    await page.goto("/nouveau-arrivant/questions");
    await page.getByLabel("Travailler").check();
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByLabel("Quelques mois").check();
    await page.getByLabel("Colocation").check();
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByRole("button", { name: "Suivant" }).click();
    for (const label of ["Me loger", "Trouver un emploi", "Santé", "Faire mes courses"]) await page.getByLabel(label).check();
    await expect(page.getByLabel("Tourisme")).toBeDisabled();
    await page.getByLabel("Santé").uncheck();
    await expect(page.getByLabel("Tourisme")).toBeEnabled();
  });

  test("le brouillon est repris après un rechargement", async ({ page }) => {
    await page.goto("/nouveau-arrivant/questions");
    await page.getByLabel("Étudier").check();
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.reload();
    await expect(page.getByText("Vos réponses précédentes ont été reprises.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Votre séjour" })).toBeVisible();
    await page.getByRole("button", { name: "Recommencer" }).click();
    await expect(page.getByRole("heading", { name: "Qu’est-ce qui vous amène à San Pedro ?" })).toBeVisible();
  });

  test("le plan place les priorités en tête et explique chaque conseil", async ({ page }) => {
    await answerUntilPlan(page);
    const blocks = page.getByRole("main").getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2 }) });
    await expect(blocks.first().getByRole("heading", { level: 2 })).toHaveText("Santé");
    await expect(blocks.nth(1).getByRole("heading", { level: 2 })).toHaveText("Se déplacer");
    await expect(blocks.first().getByText("Vous avez choisi « Santé » parmi vos priorités.")).toBeVisible();
    await expect(page.getByText(/selon des règles fixes \(sans intelligence artificielle\)/)).toBeVisible();

    const lodging = blocks.filter({ hasText: "Trouver un logement" });
    await expect(lodging).toBeVisible();
    // Contenus réels ou état vide explicite, jamais un bloc muet.
    await expect(lodging.getByText(/Exemple — Logement|Aucun contenu publié/).first()).toBeVisible();
  });

  test("« Modifier mes réponses » rouvre le questionnaire prérempli", async ({ page }) => {
    await answerUntilPlan(page);
    await page.getByRole("link", { name: "Modifier mes réponses" }).click();
    await expect(page.getByRole("heading", { name: "Récapitulatif" })).toBeVisible();
    await expect(page.getByText("Santé, Me déplacer")).toBeVisible();
  });

  test("une adresse de plan incomplète est expliquée", async ({ page }) => {
    await page.goto("/nouveau-arrivant/plan?motif=visiter");
    await expect(page.getByText("Ce plan est incomplet")).toBeVisible();
  });

  test("sans compte, enregistrer le plan passe par la connexion et y revient", async ({ page }) => {
    await answerUntilPlan(page);
    await page.getByRole("button", { name: "Enregistrer dans mon compte" }).click();
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fnouveau-arrivant%2Fplan%3Fmotif%3Ds_installer/);
  });

  test("avec un compte : enregistrement, reprise depuis le profil puis suppression", async ({ page }, testInfo) => {
    test.skip(!email || !password, "Supabase non configuré");
    // Un seul parcours par compte : exécuté en parallèle sur mobile et ordinateur avec le même
    // compte de test, chaque projet supprimerait le parcours de l'autre.
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    test.setTimeout(90_000);
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(email!);
    await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(password!);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/profil$/, { timeout: LOGIN_TIMEOUT });

    await answerUntilPlan(page);
    await page.getByRole("button", { name: "Enregistrer dans mon compte" }).click();
    await expect(page.getByText(/Parcours enregistré dans votre compte/)).toBeVisible({ timeout: LOGIN_TIMEOUT });

    await page.goto("/profil");
    const section = page.getByText("Mon parcours « Nouveau à San Pedro ? »").locator("..");
    await expect(page.getByRole("link", { name: "Voir mon plan" })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Supprimer mon parcours enregistré" }).click();
    await expect(page.getByText("Votre parcours a été supprimé.")).toBeVisible({ timeout: LOGIN_TIMEOUT });
    await page.reload();
    await expect(section.getByText("Aucun parcours enregistré.")).toBeVisible();
  });
});
