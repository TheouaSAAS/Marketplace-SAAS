import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createUnsubscribeToken } from "../src/modules/notifications/domain/email";
import { HAS_DATABASE, NO_DATABASE } from "./env";

const NETWORK = 20_000;

async function service<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=representation", "User-Agent": "e2e-notifications", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

test("un lien de désabonnement altéré est refusé", async ({ page }) => {
  await page.goto("/notifications/desabonnement?jeton=abc.def");
  await expect(page.getByText("Lien de désabonnement invalide")).toBeVisible();
  await expect(page.getByRole("link", { name: "vos préférences de notification" })).toHaveAttribute("href", "/tableau-de-bord/notifications");
});

test("la tâche d'envoi refuse toute requête sans le secret", async ({ request }) => {
  const response = await request.get("/api/interne/notifications");
  expect([401, 503]).toContain(response.status());
  const forged = await request.post("/api/interne/notifications", { headers: { Authorization: "Bearer pas-le-bon-secret-du-tout-123" } });
  expect([401, 503]).toContain(forged.status());
});

test.describe("Notifications", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("désabonnement sans connexion et alerte sur une recherche enregistrée", async ({ page }, testInfo) => {
    test.skip(!process.env.E2E_USER2_ID || !process.env.SUPABASE_SECRET_KEY, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Compte de test partagé entre projets");
    const name = `Zqe2e ${randomBytes(3).toString("hex")} studios`;
    try {
      // Désabonnement : le lien de l'e-mail suffit, aucune connexion.
      const token = createUnsubscribeToken(process.env.SUPABASE_SECRET_KEY!, process.env.E2E_USER2_ID!, "recherche");
      await page.goto(`/notifications/desabonnement?jeton=${encodeURIComponent(token)}`);
      await page.getByRole("button", { name: "Ne plus recevoir d’e-mails pour « Alertes de recherche »" }).click();
      await expect(page.getByText(/C’est fait : vous ne recevrez plus d’e-mails pour « Alertes de recherche »/)).toBeVisible({ timeout: NETWORK });
      const [prefs] = await service<{ notification_channels: Record<string, { email?: boolean }> }[]>(`/rest/v1/user_preferences?user_id=eq.${process.env.E2E_USER2_ID}&select=notification_channels`);
      expect(prefs?.notification_channels.recherche?.email).toBe(false);

      // Alerte quotidienne sur une recherche enregistrée.
      await service("/rest/v1/saved_searches", { method: "POST", body: JSON.stringify({ user_id: process.env.E2E_USER2_ID, name, query: { search: "type=annonces&q=studio", version: 1 } }) });
      await page.goto("/connexion");
      await page.getByLabel("Adresse e-mail").fill(process.env.E2E_USER2_EMAIL!);
      await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env.E2E_USER2_PASSWORD!);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
      await page.goto("/tableau-de-bord/activite");
      const item = page.getByRole("listitem").filter({ hasText: name });
      await item.getByLabel(`Alerte pour « ${name} »`).selectOption("daily");
      await item.getByRole("button", { name: "Enregistrer l’alerte" }).click();
      await expect(item.getByText("Alerte enregistrée : vous serez prévenu des nouvelles annonces.")).toBeVisible({ timeout: NETWORK });

      // Préférences : le désabonnement s'y retrouve.
      await page.goto("/tableau-de-bord/notifications");
      await expect(page.getByLabel("E-mail : Alertes de recherche", { exact: true })).not.toBeChecked();
    } finally {
      await service(`/rest/v1/saved_searches?name=eq.${encodeURIComponent(name)}`, { method: "DELETE" });
      await service(`/rest/v1/user_preferences?user_id=eq.${process.env.E2E_USER2_ID}`, { method: "PATCH", body: JSON.stringify({ notification_channels: {} }) });
    }
  });
});
