import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/**
 * Connexion des comptes de test. Le compte E2E_ADMIN a un second facteur
 * (TOTP) configuré par global-setup : il passe par l'étape « second facteur »
 * exactement comme une personne de l'équipe, codes calculés depuis la clé.
 */

export type TestAccount = "E2E_USER" | "E2E_USER2" | "E2E_ADMIN";

const NETWORK = 20_000;

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

/** Code TOTP (RFC 6238 : SHA-1, 30 s, 6 chiffres), comme une application d'authentification. */
export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

const leftVerification = (url: URL) => !url.pathname.startsWith("/admin/verification");

/**
 * Étape du second facteur (page /admin/verification affichée). On attend la
 * navigation elle-même (réseau lent) ; un code refusé est retenté avec le code
 * de la période suivante, une vérification indisponible est rechargée.
 */
export async function passSecondFactor(page: Page): Promise<void> {
  const secret = process.env.E2E_ADMIN_TOTP_SECRET;
  if (!secret) throw new Error("E2E_ADMIN_TOTP_SECRET absent : second facteur non configuré par global-setup.");
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (await page.getByText("Vérification momentanément indisponible").isVisible()) await page.reload();
    await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
    await page.getByRole("button", { name: /Vérifier et ouvrir l’administration/ }).click();
    try {
      await page.waitForURL(leftVerification, { timeout: 40_000 });
      return;
    } catch {
      // Code refusé (déjà utilisé dans cette période) : attendre la période suivante.
      await page.waitForTimeout(30_500 - (Date.now() % 30_000));
    }
  }
  throw new Error("Second facteur de test refusé trois fois.");
}

/** Connexion par la page publique ; l'administrateur de test termine par son second facteur et arrive sur /admin. */
export async function signInAs(page: Page, account: TestAccount): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(process.env[`${account}_EMAIL`]!);
  await page.getByRole("textbox", { name: "Mot de passe", exact: true }).fill(process.env[`${account}_PASSWORD`]!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  if (account === "E2E_ADMIN") {
    await expect(page).toHaveURL(/\/admin\/verification/, { timeout: NETWORK });
    await passSecondFactor(page);
  } else {
    await expect(page).toHaveURL(/\/profil$/, { timeout: NETWORK });
  }
}
