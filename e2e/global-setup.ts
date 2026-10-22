import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";

/**
 * Crée des comptes de test CONFIRMÉS par l'API d'administration (aucun e-mail
 * envoyé), exposés aux tests par variables d'environnement, supprimés dans
 * global-teardown. Deux comptes indépendants : les tests qui tournent en
 * parallèle ne se perturbent pas (E2E_USER_* pour les comptes et parcours,
 * E2E_USER2_* pour la fiche annonce et la messagerie). Sans Supabase
 * configuré, les tests de compte sont ignorés.
 */
async function createUser(url: string, secret: string, prefix: "E2E_USER" | "E2E_USER2", displayName: string) {
  const email = `e2e-${randomBytes(6).toString("hex")}@test.invalid`;
  const password = `E2e${randomBytes(9).toString("hex")}`;
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "User-Agent": "e2e-setup" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, consents: { terms: "2026-10", privacy: "2026-10" } },
    }),
  });
  if (!response.ok) throw new Error(`Création du compte de test impossible : HTTP ${response.status} ${await response.text()}`);
  const user = (await response.json()) as { id: string };
  process.env[`${prefix}_ID`] = user.id;
  process.env[`${prefix}_EMAIL`] = email;
  process.env[`${prefix}_PASSWORD`] = password;
}

export default async function globalSetup() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return;
  await createUser(url, secret, "E2E_USER", "Testeur E2E");
  await createUser(url, secret, "E2E_USER2", "Testeur E2E bis");
}
