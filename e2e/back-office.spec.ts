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

async function service<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=representation", "User-Agent": "e2e-back-office", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

test("l'administration exige une connexion", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/connexion\?suivant=%2Fadmin$/, { timeout: NETWORK });
});

test.describe("Back-office", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("signalement traité par suspension, auteur prévenu, décision journalisée ; membre sans accès", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_USER2_ID || !process.env.E2E_USER_ID || !process.env.E2E_ADMIN_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(180_000);
    const title = `Zqe2e ${randomBytes(3).toString("hex")} Téléphone neuf`;
    const reason = `Acompte exigé avant remise (${title})`;
    try {
      // Mise en place (clé secrète) : une annonce publiée et un signalement d'un autre membre.
      const [category] = await service<{ id: string }[]>("/rest/v1/categories?slug=eq.climatisation&select=id");
      const [city] = await service<{ id: string }[]>("/rest/v1/cities?is_default=eq.true&select=id");
      const [listing] = await service<{ id: string; slug: string }[]>("/rest/v1/listings", {
        method: "POST",
        body: JSON.stringify({ owner_id: process.env.E2E_USER2_ID, slug: `zqe2e-${randomBytes(4).toString("hex")}`, title, description: "Annonce de test automatique, signalée puis suspendue.", category_id: category!.id, city_id: city!.id, location: "SRID=4326;POINT(-6.6363 4.7485)", location_precision: "approximate", status: "published" }),
      });
      await service("/rest/v1/reports", { method: "POST", body: JSON.stringify({ reporter_id: process.env.E2E_USER_ID, listing_id: listing!.id, reason: "arnaque", details: "Demande un acompte (test automatique)" }) });

      // Un membre n'a aucun outil d'administration.
      const member = await asUser(browser, "E2E_USER");
      await expect(member.getByText("Mes publications")).toBeVisible({ timeout: NETWORK });
      await expect(member.getByRole("link", { name: "Ouvrir l’administration" })).toHaveCount(0);
      await member.goto("/admin");
      await expect(member.getByText("Accès réservé")).toBeVisible({ timeout: NETWORK });

      // L'administrateur suspend le contenu depuis la file.
      const admin = await asUser(browser, "E2E_ADMIN");
      await admin.getByRole("link", { name: "Ouvrir l’administration" }).click();
      await expect(admin.getByRole("heading", { level: 1 })).toHaveText("Administration", { timeout: NETWORK });
      await admin.getByRole("link", { name: "Traiter les signalements" }).click();
      const card = admin.getByRole("listitem").filter({ hasText: title });
      await expect(card.getByText("Arnaque ou tentative de fraude")).toBeVisible({ timeout: NETWORK });
      await card.getByRole("button", { name: "Suspendre l’annonce" }).click();
      await expect(card.getByText(/Indiquez la raison/)).toBeVisible({ timeout: NETWORK });
      await card.getByLabel("Raison de la décision").fill(reason);
      await card.getByRole("button", { name: "Suspendre l’annonce" }).click();
      await expect(admin.getByText(/Contenu suspendu : il n’est plus visible/)).toBeVisible({ timeout: NETWORK });
      const [after] = await service<{ status: string }[]>(`/rest/v1/listings?id=eq.${listing!.id}&select=status`);
      expect(after!.status).toBe("rejected");

      // Journal : auteur, raison, avant et après.
      await admin.goto("/admin/journal?action=signalement.");
      const entry = admin.getByRole("listitem").filter({ hasText: reason });
      await expect(entry.getByText("Contenu suspendu après signalement")).toBeVisible({ timeout: NETWORK });
      await expect(entry.getByText("Avant : open → après : resolved")).toBeVisible();

      // L'auteur est prévenu du motif.
      const author = await asUser(browser, "E2E_USER2");
      await author.goto("/tableau-de-bord/notifications");
      await expect(author.getByText(`Annonce suspendue : ${title}`)).toBeVisible({ timeout: NETWORK });
    } finally {
      await service(`/rest/v1/notifications?title=like.*${encodeURIComponent(title)}*`, { method: "DELETE" });
      await service(`/rest/v1/admin_audit_log?details->>raison=like.*${encodeURIComponent(title)}*`, { method: "DELETE" });
      await service(`/rest/v1/listings?title=eq.${encodeURIComponent(title)}`, { method: "DELETE" });
    }
  });
});
