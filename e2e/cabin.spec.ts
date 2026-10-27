import { expect, test, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";
import { signInAs } from "./sign-in";

const NETWORK = 20_000;

/** Supprime les opérations de démonstration créées par le test (clé secrète). */
async function deleteOperations(references: string[]) {
  if (references.length === 0) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  await fetch(`${url}/rest/v1/cabin_operations?reference=in.(${references.join(",")})`, {
    method: "DELETE",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "User-Agent": "e2e-cabine" },
  });
}

async function chooseService(page: Page, label: string) {
  await page.getByRole("button", { name: new RegExp(label) }).click();
  await expect(page.getByRole("heading", { level: 2, name: /2\. Réseau/ })).toBeVisible();
}

test.describe("Cabine en ligne", () => {
  test("page publique, signalée en démonstration, avec les quatre familles de services", async ({ page }) => {
    const response = await page.goto("/cabine");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cabine en ligne");
    await expect(page.getByText("Nous ne demandons jamais votre code secret Mobile Money ou bancaire.")).toBeVisible();
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await expect(page.getByText("Mode démonstration : aucune opération réelle")).toBeVisible({ timeout: NETWORK });
    for (const family of ["Crédit et unités", "Offres Internet", "Électricité CIE", "Transfert d’argent"]) {
      await expect(page.getByRole("group", { name: family })).toBeVisible();
    }
    await expect(page.getByText(/Frais de service : 0,5 %/)).toBeVisible();
  });

  test("crédit téléphonique : frais de 0,5 % et total avant confirmation, démonstration jamais réussie, aucune double opération", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    const references: string[] = [];
    try {
      await page.goto("/cabine");
      await chooseService(page, "Crédit téléphonique");
      await page.getByRole("button", { name: "Orange", exact: true }).click();
      await page.getByRole("button", { name: "Continuer" }).click();
      await page.getByLabel("Numéro à recharger").fill("07 08 09 10 11");
      await page.getByRole("button", { name: "Continuer" }).click();
      await page.getByLabel("Montant (F CFA)").fill("10000");
      await page.getByRole("button", { name: "Voir le récapitulatif" }).click();

      const recap = page.locator("dl").filter({ hasText: "Total à payer" });
      await expect(recap).toBeVisible({ timeout: NETWORK });
      await expect(recap).toContainText("07 ** ** ** 11");
      await expect(recap.getByText("Frais de service (0,5 %)")).toBeVisible();
      await expect(recap).toContainText("50 F CFA");
      await expect(recap).toContainText("10 050 F CFA");
      await expect(page.getByText("Démonstration : aucun paiement ne sera effectué")).toBeVisible();

      // Double clic : une seule opération (même clé d'idempotence).
      const finish = page.getByRole("button", { name: "Terminer la démonstration (aucun paiement)" });
      await finish.dblclick();
      const status = page.getByRole("status").filter({ hasText: "Référence" });
      await expect(status).toBeVisible({ timeout: NETWORK });
      await expect(status.getByText("Annulée", { exact: true })).toBeVisible();
      await expect(status.getByText("Démonstration", { exact: true })).toBeVisible();
      await expect(page.getByText("Réussie", { exact: true })).toHaveCount(0);
      const reference = (await status.textContent())?.match(/CAB-[0-9A-F]{10}/)?.[0];
      expect(reference).toBeTruthy();
      references.push(reference!);
    } finally {
      await deleteOperations(references);
    }
  });

  test("sans catalogue, aucune offre Internet n'est inventée", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/cabine");
    await chooseService(page, "Offres Internet");
    await page.getByRole("button", { name: "MTN", exact: true }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Numéro à recharger").fill("0501020304");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Aucune offre disponible pour ce réseau")).toBeVisible();
    await expect(page.getByRole("button", { name: "Voir le récapitulatif" })).toBeDisabled();
  });

  test("transfert : les combinaisons non prises en charge sont signalées", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/cabine");
    await chooseService(page, "Transfert entre réseaux");
    for (const wallet of ["Wave", "Orange Money", "Moov Money", "MTN MoMo"]) {
      await expect(page.getByRole("button", { name: wallet, exact: true }).first()).toBeVisible();
    }
    await page.getByRole("button", { name: "Wave", exact: true }).click();
    await page.getByRole("button", { name: /Orange Money Non pris en charge/ }).click();
    await expect(page.getByText("Combinaison non prise en charge")).toBeVisible();
  });

  test("recharge CIE : numéro de compteur vérifié", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/cabine");
    await chooseService(page, "Recharge compteur CIE");
    await page.getByRole("button", { name: /CIE/ }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    const meter = page.getByLabel("Numéro du compteur CIE");
    await meter.fill("12AB");
    await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
    await meter.fill("12345678901");
    await expect(page.getByRole("button", { name: "Continuer" })).toBeEnabled();
  });

  test("l'administration de la cabine est réservée aux administrateurs", async ({ page }, testInfo) => {
    test.skip(!HAS_DATABASE || !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_USER2_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(150_000);
    await signInAs(page, "E2E_USER2");
    await page.goto("/admin/cabine");
    await expect(page).toHaveURL(/\/admin\/cabine/, { timeout: NETWORK });
    await expect(page.getByText("Accès réservé")).toBeVisible({ timeout: NETWORK });
    await expect(page.getByRole("heading", { name: "Opérations" })).toHaveCount(0);

    const admin = await (await page.context().browser()!.newContext()).newPage();
    await signInAs(admin, "E2E_ADMIN");
    await admin.goto("/admin/cabine");
    await expect(admin.getByRole("heading", { level: 1 })).toHaveText("Cabine en ligne");
    await expect(admin.getByText("Aucune intégration de prestataire installée")).toBeVisible();
    for (const section of ["Opérations", "Services et frais", "Prestataires", "Réseaux", "Transferts entre réseaux", "Catalogue des offres Internet"]) {
      await expect(admin.getByRole("heading", { level: 2, name: section, exact: true })).toBeVisible();
    }
    await expect(admin.getByLabel("Frais de service (%)").first()).toHaveValue("0,5");
  });
});
