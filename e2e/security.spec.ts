import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

test.describe("Sécurité", () => {
  test("les en-têtes de sécurité protègent chaque page", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    const csp = headers["content-security-policy"] ?? "";
    for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) {
      expect(csp, directive).toContain(directive);
    }
    expect(csp).not.toMatch(/script-src[^;]*https?:/);
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("la carte fonctionne sous la politique de contenu, sans violation", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to (load|connect|execute)/i.test(message.text()) && !/kaspersky/i.test(message.text())) violations.push(message.text());
    });
    await page.goto("/carte");
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(violations, violations.join("\n")).toEqual([]);
  });

  test("le formulaire d'inscription porte le défi anti-robot, invisible pour les personnes", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/inscription");
    const trap = page.locator('input[name="site_web"]');
    await expect(trap).toHaveCount(1);
    await expect(trap).not.toBeInViewport();
    await expect(trap).toHaveAttribute("tabindex", "-1");
    await expect(page.locator('input[name="ouvert_a"]')).toHaveCount(1);
  });

  test("la charte de confiance est publique et l'accord de transaction imprimable", async ({ page }) => {
    await page.goto("/charte-de-confiance");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Charte de confiance");
    await expect(page.getByText(/Ne jamais demander d’argent avant une visite/)).toBeVisible();
  });

  test("chaque annonce propose un accord de transaction à imprimer, non indexé", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/annonces/exemple-logement-location");
    await page.getByText("Conseils de sécurité").click();
    await page.getByRole("link", { name: "Accord de transaction à imprimer" }).click();
    await expect(page).toHaveURL(/\/annonces\/exemple-logement-location\/accord$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accord de transaction");
    await expect(page.getByRole("button", { name: "Imprimer ou enregistrer en PDF" })).toBeVisible();
    await expect(page.getByText(/Modèle indicatif/).first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("les outils de fraude et de recours sont fermés aux membres", async ({ page }) => {
    await page.goto("/admin/fraude");
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fadmin%2Ffraude/);
  });
});
