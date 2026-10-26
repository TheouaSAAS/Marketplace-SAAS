import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";
import { png } from "./png";
import { signInAs } from "./sign-in";

const NETWORK = 20_000;
const PREFIX = "Zqe2e ";

async function asUser(browser: Browser, prefix: "E2E_USER" | "E2E_USER2" | "E2E_ADMIN"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signInAs(page, prefix);
  return page;
}

function service(path: string, init: RequestInit = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY!;
  return fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "User-Agent": "e2e-pages-pro", ...(init.headers ?? {}) },
  });
}

/** Supprime la page de test, ses photos, son équipe et la source de vérification (clé secrète). */
async function cleanup(name: string) {
  try {
    const pages = (await (await service(`/rest/v1/business_profiles?name=eq.${encodeURIComponent(name)}&select=id`)).json()) as { id: string }[];
    if (pages.length) {
      const ids = pages.map((page) => page.id).join(",");
      const images = (await (await service(`/rest/v1/images?business_id=in.(${ids})&select=storage_path,bucket`)).json()) as { storage_path: string; bucket: string }[];
      for (const bucket of ["media", "private-media"]) {
        const prefixes = images.filter((image) => image.bucket === bucket).map((image) => image.storage_path);
        if (prefixes.length) await service(`/storage/v1/object/${bucket}`, { method: "DELETE", body: JSON.stringify({ prefixes }) });
      }
    }
    await service(`/rest/v1/business_profiles?name=eq.${encodeURIComponent(name)}`, { method: "DELETE" });
    await service(`/rest/v1/organizations?name=eq.${encodeURIComponent(name)}`, { method: "DELETE" });
    await service(`/rest/v1/sources?title=like.${encodeURIComponent(PREFIX)}*`, { method: "DELETE" });
  } catch {
    // Nettoyage au mieux : un résidu reste marqué « Zqe2e ».
  }
}

test.describe("Pages professionnelles", () => {
  test.skip(!HAS_DATABASE, NO_DATABASE);

  test("l'annuaire filtre et explique ses badges", async ({ page }) => {
    await page.goto("/professionnels");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Professionnels et entreprises");
    const form = page.getByRole("form", { name: "Filtres de l’annuaire" });
    await form.getByLabel("Nom, prestation, mot-clé").fill("plomberie");
    await form.getByLabel("Vérifiés par l’équipe locale seulement").check();
    await form.getByRole("button", { name: "Rechercher" }).click();
    await expect(page).toHaveURL(/\/professionnels\?q=plomberie&verifie=1$/, { timeout: NETWORK });
    await page.getByText("Pourquoi cet ordre ? Que signifient les badges ?").click();
    await expect(page.getByText("Les informations sont déclarées, pas vérifiées.")).toBeVisible();
  });

  test("création, équipe, modération, vérification, avis et réponse", async ({ browser }, testInfo) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_USER2_EMAIL || !process.env.E2E_USER_EMAIL, NO_DATABASE);
    test.skip(testInfo.project.name !== "desktop", "Comptes de test partagés entre projets");
    test.setTimeout(300_000);
    const name = `${PREFIX}${randomBytes(3).toString("hex")} Plomberie`;
    try {
      // Le professionnel crée et complète sa page.
      const pro = await asUser(browser, "E2E_USER2");
      await pro.getByRole("link", { name: "Mes pages professionnelles" }).click();
      await pro.getByLabel("Nom de l’activité").fill(name);
      const category = await pro.locator('select[name="categorie"] option', { hasText: "Plomberie" }).first().getAttribute("value");
      await pro.getByLabel("Catégorie").selectOption(category!);
      await pro.getByRole("button", { name: "Créer la page" }).click();
      await expect(pro).toHaveURL(/\/mes-pages-pro\/[0-9a-f-]{36}$/, { timeout: NETWORK });
      const editor = pro.url();

      await pro.getByLabel("Présentation", { exact: true }).fill("Plomberie générale, recherche de fuites et installation sanitaire. Page de test automatique, à ignorer.");
      await pro.getByLabel("Prestations").fill("Dépannage\nInstallation sanitaire");
      await pro.getByLabel("Zone desservie").fill("San Pedro et environs");
      await pro.getByLabel("Téléphone", { exact: true }).fill("+225 07 00 00 00 00");
      await pro.getByLabel("Lundi").fill("08:00-17:00");
      await pro.getByLabel("Samedi").fill("fermé");
      await pro.getByLabel("Lien 1 : titre").fill("Facebook");
      await pro.getByLabel("Lien 1 : adresse").fill("https://facebook.com/exemple-test");
      await pro.getByLabel("Question 1").fill("Intervenez-vous le dimanche ?");
      await pro.getByLabel("Réponse 1").fill("Non, du lundi au vendredi seulement.");
      await pro.getByRole("button", { name: "Enregistrer la page" }).click();
      await expect(pro.getByText("Page enregistrée.")).toBeVisible({ timeout: NETWORK });
      await pro.locator('input[type="file"][accept^="image"]').setInputFiles({ name: "atelier.png", mimeType: "image/png", buffer: png(1000, 750) });
      await expect(pro.getByRole("list", { name: "Photos de l’annonce" }).getByRole("listitem")).toHaveCount(1, { timeout: NETWORK });
      await pro.reload();
      await expect(pro.getByRole("heading", { name: "Profil complété : 7/7" })).toBeVisible({ timeout: NETWORK });

      // Équipe : création, invitation par lien, acceptation, puis retrait.
      await pro.getByRole("button", { name: "Créer l’équipe" }).click();
      await expect(pro.getByRole("list", { name: "Membres de l’équipe" })).toBeVisible({ timeout: NETWORK });
      await pro.getByLabel("Rôle de la personne invitée").selectOption("viewer");
      await pro.getByRole("button", { name: "Créer un lien d’invitation" }).click();
      const invitation = await pro.getByLabel("Lien d’invitation", { exact: true }).inputValue({ timeout: NETWORK });
      expect(invitation).toMatch(/\/mes-pages-pro\/invitation\/[0-9a-f]{64}$/);

      const colleague = await asUser(browser, "E2E_USER");
      await colleague.goto(new URL(invitation).pathname);
      await expect(colleague.getByText(/avec le rôle Lecteur/)).toBeVisible();
      await colleague.getByRole("button", { name: "Rejoindre l’équipe" }).click();
      await expect(colleague).toHaveURL(/\/mes-pages-pro\?equipe=1$/, { timeout: NETWORK });
      await colleague.getByRole("link", { name }).click();
      await expect(colleague.getByText("Vous consultez cette page en lecture seule (rôle « Lecteur »).")).toBeVisible({ timeout: NETWORK });

      await pro.reload();
      const member = pro.getByRole("list", { name: "Membres de l’équipe" }).getByRole("listitem").filter({ hasNotText: "(vous)" });
      await member.getByRole("combobox").selectOption("retirer");
      await member.getByRole("button", { name: "Appliquer" }).click();
      await expect(pro.getByRole("list", { name: "Membres de l’équipe" }).getByRole("listitem")).toHaveCount(1, { timeout: NETWORK });

      // Soumission et publication.
      await pro.getByRole("button", { name: "Soumettre à la modération" }).click();
      await expect(pro).toHaveURL(/\/mes-pages-pro\?soumise=1$/, { timeout: NETWORK });
      const moderator = await asUser(browser, "E2E_ADMIN");
      await moderator.goto("/admin");
      await moderator.getByRole("link", { name: "Modérer et vérifier les pages pro" }).click();
      await moderator.getByRole("listitem").filter({ hasText: name }).first().getByRole("button", { name: "Publier" }).click();
      await expect(moderator.getByText("Page publiée : ses photos sont en ligne et le professionnel est notifié.")).toBeVisible({ timeout: NETWORK });

      // Annuaire et page publique : badges distincts, FAQ, contact, photo publique.
      await pro.goto(`/professionnels?q=${encodeURIComponent(name.split(" ")[1]!)}`);
      const card = pro.getByRole("article").filter({ hasText: name });
      await expect(card.getByText("Profil complété")).toBeVisible({ timeout: NETWORK });
      await expect(card.getByText("Vérifié", { exact: true })).toHaveCount(0);
      await card.getByRole("link", { name }).click();
      await expect(pro.getByRole("heading", { level: 1 })).toHaveText(name, { timeout: NETWORK });
      await expect(pro.getByText("Intervenez-vous le dimanche ?")).toBeVisible();
      await expect(pro.getByRole("link", { name: /\+225 07 00 00 00 00/ })).toHaveAttribute("href", "tel:+2250700000000");
      const photo = pro.getByRole("img", { name: `${name} — photo 1` });
      await expect(photo).toBeVisible();
      expect(decodeURIComponent((await photo.getAttribute("src")) ?? "")).toContain("/storage/v1/object/public/media/");
      const publicPage = pro.url();

      // Vérification demandée puis accordée avec une source.
      await pro.goto(editor);
      await pro.getByLabel("Élément vérifiable").fill("RCCM de test automatique, à ignorer");
      await pro.getByRole("button", { name: "Demander la vérification" }).click();
      await expect(pro.getByText(/Demande envoyée le .* badge « En cours de validation »/)).toBeVisible({ timeout: NETWORK });
      await pro.goto(publicPage);
      await expect(pro.getByText("En cours de validation").first()).toBeVisible();
      await moderator.goto("/admin/professionnels");
      const request = moderator.getByRole("listitem").filter({ hasText: name }).filter({ hasText: "Élément proposé" });
      await request.getByLabel("Source du contrôle (obligatoire pour vérifier)").fill(`${PREFIX}registre consulté`);
      await request.getByRole("button", { name: "Marquer vérifié" }).click();
      await expect(moderator.getByText("Page marquée vérifiée, avec sa source.")).toBeVisible({ timeout: NETWORK });
      await pro.reload();
      await expect(pro.getByText("Vérifié", { exact: true }).first()).toBeVisible();
      await expect(pro.getByText("En cours de validation")).toHaveCount(0);

      // Avis d'un client (compte vieilli de 30 jours pour la règle des 7 jours), modération, réponse.
      await service(`/rest/v1/profiles?id=eq.${process.env.E2E_USER_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ created_at: new Date(Date.now() - 30 * 86_400_000).toISOString() }),
      });
      await colleague.goto(publicPage);
      await colleague.getByText("Donner mon avis").click();
      await colleague.getByRole("radio", { name: "4", exact: true }).check();
      await colleague.getByLabel("Votre avis (facultatif)").fill("Intervention rapide et propre. Avis de test automatique.");
      await colleague.getByRole("button", { name: "Envoyer mon avis" }).click();
      await expect(colleague.getByText(/Votre avis sera publié après relecture/)).toBeVisible({ timeout: NETWORK });
      await moderator.goto("/admin/avis");
      await moderator.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Publier" }).click();
      await expect(moderator.getByText("Avis publié : son auteur et le professionnel sont notifiés.")).toBeVisible({ timeout: NETWORK });
      await pro.goto(editor);
      const received = pro.getByRole("listitem").filter({ hasText: "Avis de test automatique" });
      await received.getByLabel("Répondre publiquement").fill("Merci pour votre retour.");
      await received.getByRole("button", { name: "Publier la réponse" }).click();
      await expect(received.getByText("Réponse publiée sous l’avis.")).toBeVisible({ timeout: NETWORK });
      await colleague.reload();
      await expect(colleague.getByText("Réponse du professionnel")).toBeVisible({ timeout: NETWORK });
      await expect(colleague.getByText("Merci pour votre retour.")).toBeVisible();
    } finally {
      await cleanup(name);
    }
  });
});
