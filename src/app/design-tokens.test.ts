// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Contrôle de contraste WCAG 2.2 sur les jetons réels de globals.css.
 * Toute modification de palette qui rendrait un texte illisible fait échouer ce test.
 */

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function resolveToken(name: string, seen = new Set<string>()): string {
  if (seen.has(name)) throw new Error(`Référence circulaire : ${name}`);
  seen.add(name);
  const match = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`Jeton introuvable : --color-${name}`);
  const value = match[1].trim();
  const reference = value.match(/^var\(--color-([\w-]+)\)$/);
  return reference?.[1] ? resolveToken(reference[1], seen) : value;
}

function luminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string): number {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x) as [number, number];
  return (a + 0.05) / (b + 0.05);
}

const WHITE = "#ffffff";

/** [texte, fond, ratio minimal, usage] — 4,5 pour le texte courant, 3 pour le gros texte et les composants. */
const PAIRS: [string, string, number, string][] = [
  ["ink", "surface", 4.5, "texte principal"],
  ["ink-muted", "surface", 4.5, "texte secondaire"],
  ["ink-muted", "surface-muted", 4.5, "texte secondaire sur fond de page"],
  ["ink-subtle", "surface", 4.5, "texte d’aide, placeholders"],
  ["brand-700", "surface", 4.5, "liens"],
  ["success", "success-soft", 4.5, "badge Vérifié / Publiée"],
  ["warning", "warning-soft", 4.5, "badge À vérifier"],
  ["danger", "danger-soft", 4.5, "badge erreur / Refusé"],
  ["info", "info-soft", 4.5, "badge information"],
  ["sand-700", "surface", 4.5, "badge Exemple"],
  ["sand-700", "sand-100", 4.5, "badge neutre"],
  ["accent-700", "accent-100", 4.5, "badge Sponsorisé"],
  ["brand-700", "brand-50", 4.5, "compteur d’onglet actif"],
  ["brand-100", "brand-900", 4.5, "texte clair du bandeau d’accueil"],
];

const ON_WHITE_TEXT: [string, string][] = [
  ["brand-600", "bouton principal"],
  ["accent-600", "bouton Publier"],
  ["danger", "bouton destructif"],
];

describe("contraste des jetons (WCAG 2.2 AA)", () => {
  it.each(PAIRS)("%s sur %s ≥ %s (%s)", (text, background, minimum) => {
    expect(contrast(resolveToken(text), resolveToken(background))).toBeGreaterThanOrEqual(minimum);
  });

  it.each(ON_WHITE_TEXT)("texte blanc sur %s ≥ 4,5 (%s)", (background) => {
    expect(contrast(WHITE, resolveToken(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("le contour de focus se distingue du fond (≥ 3:1)", () => {
    expect(contrast(resolveToken("focus"), resolveToken("surface"))).toBeGreaterThanOrEqual(3);
  });

  it("respecte la préférence de mouvement réduit", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
