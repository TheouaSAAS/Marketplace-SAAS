import { expect, test } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

test.describe("Référencement", () => {
  test("robots.txt n'expose que des préfixes valides et annonce le sitemap", async ({ request }) => {
    const text = await (await request.get("/robots.txt")).text();
    expect(text).toContain("Disallow: /publier/");
    expect(text).toContain("Disallow: /tableau-de-bord");
    expect(text).toContain("Disallow: /api/");
    expect(text).not.toContain("[");
    expect(text).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  test("le sitemap ne contient ni gabarit, ni page privée, ni exemple de démonstration", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/aide</loc>");
    expect(xml).not.toContain("[");
    expect(xml).not.toContain("/tableau-de-bord");
    expect(xml).not.toContain("exemple-");
  });

  test("l'accueil a son adresse canonique et une image de partage", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/$|^https?:\/\/[^/]+$/);
    const image = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(image).toBeTruthy();
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const response = await request.get(new URL(image!).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });

  test("une rubrique garde sa catégorie dans la canonique ; une variante filtrée n'est pas indexée", async ({ page }) => {
    await page.goto("/commerces?type=restaurants");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/commerces\?type=restaurants$/);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await page.goto("/commerces?type=restaurants&budget=2&q=poisson");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/commerces\?type=restaurants$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("une fiche d'exemple a sa canonique, n'est pas indexée et ne publie aucune donnée structurée d'activité", async ({ page }) => {
    test.skip(!HAS_DATABASE, NO_DATABASE);
    await page.goto("/lieux/exemple-lieu-a-visiter");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/lieux\/exemple-lieu-a-visiter$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.some((block) => /LocalBusiness|TouristAttraction/.test(block))).toBe(false);
    expect(blocks.some((block) => block.includes("BreadcrumbList"))).toBe(true);
  });
});
