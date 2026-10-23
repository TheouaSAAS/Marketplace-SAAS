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
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=representation", "User-Agent": "e2e-espace-pro", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

test("l'espace professionnel exige une connexion", async ({ page }) => {
  await page.goto("/espace-pro");
  await expect(page).toHaveURL(/\/connexion\?suivant=%2Fespace-pro/, { timeout: NETWORK });
});

test("les offres sont présentées sans promesse de paiement", async ({ page }) => {
  await page.goto("/offres");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Offres et visibilité");
  await expect(page.getByText(/Le paiement en ligne n’est pas ouvert : aucune somme n’est demandée/)).toBeVisible();
});

test.describe("Espace professionnel", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("rôles, boîte de réception, publication pour la page, statistiques et historique", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_USER2_ID || !process.env.E2E_USER_ID || !process.env.E2E_ADMIN_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(180_000);
    const name = `Zqe2e ${randomBytes(3).toString("hex")} Climatisation`;
    try {
      // Mise en place (clé secrète) : page publiée avec son équipe, une demande reçue, une annonce refusée.
      const [category] = await service<{ id: string }[]>("/rest/v1/categories?slug=eq.climatisation&select=id");
      const [city] = await service<{ id: string }[]>("/rest/v1/cities?is_default=eq.true&select=id");
      const [org] = await service<{ id: string }[]>("/rest/v1/organizations", {
        method: "POST",
        body: JSON.stringify({ name, slug: `zqe2e-${randomBytes(4).toString("hex")}`, kind: "artisan", city_id: city!.id, created_by: process.env.E2E_USER2_ID }),
      });
      await service("/rest/v1/organization_members", { method: "POST", body: JSON.stringify({ organization_id: org!.id, user_id: process.env.E2E_USER_ID, role: "viewer" }) });
      const [business] = await service<{ id: string; slug: string }[]>("/rest/v1/business_profiles", {
        method: "POST",
        body: JSON.stringify({ owner_id: process.env.E2E_USER2_ID, organization_id: org!.id, name, slug: `zqe2e-${randomBytes(4).toString("hex")}`, category_id: category!.id, city_id: city!.id, status: "published", accepts_quotes: true }),
      });
      await service("/rest/v1/contact_requests", {
        method: "POST",
        body: JSON.stringify({ business_id: business!.id, recipient_id: process.env.E2E_USER2_ID, sender_name: "Client de test", sender_phone: "0700000001", message: "Climatiseur en panne, devis svp. (test automatique)", kind: "devis", consented_at: new Date().toISOString() }),
      });
      await service("/rest/v1/listings", {
        method: "POST",
        body: JSON.stringify({ owner_id: process.env.E2E_USER2_ID, business_id: business!.id, organization_id: org!.id, slug: `zqe2e-${randomBytes(4).toString("hex")}`, title: `${name} entretien`, description: "Entretien de climatiseurs, annonce de test automatique.", category_id: category!.id, city_id: city!.id, location: "SRID=4326;POINT(-6.6363 4.7485)", location_precision: "approximate", status: "rejected", rejection_reason: "Ajoutez une photo de test" }),
      });
      const workspace = `/espace-pro/${business!.id}`;

      // Titulaire : aperçu, demande traitée, annonces, publication au nom de la page.
      const pro = await asUser(browser, "E2E_USER2");
      await pro.goto("/espace-pro");
      await pro.getByRole("link", { name }).click();
      await expect(pro).toHaveURL(new RegExp(`${workspace}$`), { timeout: NETWORK });
      await expect(pro.getByRole("heading", { name: "Ce qu’il faut faire" })).toBeVisible();
      await pro.getByRole("navigation", { name: "Espace professionnel" }).getByRole("link", { name: "Demandes" }).click();
      const request = pro.getByRole("listitem").filter({ hasText: "Client de test" });
      await expect(request.getByText("0700000001")).toBeVisible({ timeout: NETWORK });
      await request.getByLabel("Statut de la demande").selectOption("replied");
      await request.getByRole("button", { name: "Enregistrer" }).click();
      await expect(request.locator("span", { hasText: /^Répondue$/ })).toBeVisible({ timeout: NETWORK });

      await pro.goto(`${workspace}/annonces`);
      await expect(pro.getByText("Correction demandée : Ajoutez une photo de test")).toBeVisible();
      await pro.getByRole("link", { name: "Publier une annonce pour la page" }).click();
      await expect(pro.getByText(`Annonce publiée au nom de la page « ${name} »`)).toBeVisible({ timeout: NETWORK });

      await pro.goto(`${workspace}/verification`);
      await expect(pro.getByText(/correction demandée : Ajoutez une photo de test/)).toBeVisible();

      // Une vue d'un visiteur est comptée ; jamais celle du titulaire.
      const visitor = await (await browser.newContext()).newPage();
      await visitor.goto(`/professionnels/${business!.slug}`);
      await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(name, { timeout: NETWORK });
      await pro.goto(`/professionnels/${business!.slug}`);
      await expect
        .poll(
          async () => {
            await pro.goto(`${workspace}/statistiques`);
            return pro.getByText("Vues de la page", { exact: true }).locator("..").locator("dd").first().innerText();
          },
          { timeout: NETWORK },
        )
        .toBe("1");
      await expect(pro.getByText(/ne disent jamais qui a vu, aimé ou consulté/)).toBeVisible();

      // Lecteur : consulte sans voir les coordonnées des clients.
      const viewer = await asUser(browser, "E2E_USER");
      await viewer.goto(`${workspace}/demandes`);
      await expect(viewer.getByText("Réservé aux éditeurs")).toBeVisible({ timeout: NETWORK });
      await expect(viewer.getByText("0700000001")).toHaveCount(0);
      await viewer.goto(`${workspace}/annonces`);
      await expect(viewer.getByText(/Rôle « Lecteur »/)).toBeVisible();

      // Une autre équipe (ou l'équipe du site) n'y accède pas.
      const outsider = await asUser(browser, "E2E_ADMIN");
      await outsider.goto(workspace);
      await expect(outsider.getByText("Cette page est introuvable")).toBeVisible({ timeout: NETWORK });
    } finally {
      await service(`/rest/v1/listings?title=like.${encodeURIComponent(name)}*`, { method: "DELETE" });
      await service(`/rest/v1/business_profiles?name=eq.${encodeURIComponent(name)}`, { method: "DELETE" });
      await service(`/rest/v1/organizations?name=eq.${encodeURIComponent(name)}`, { method: "DELETE" });
    }
  });
});
