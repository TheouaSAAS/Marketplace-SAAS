import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";

/**
 * Crée un compte de test CONFIRMÉ par l'API d'administration (aucun e-mail
 * envoyé), exposé aux tests par variables d'environnement. Supprimé dans
 * global-teardown. Sans Supabase configuré, les tests de compte sont ignorés.
 */
export default async function globalSetup() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return;

  const email = `e2e-${randomBytes(6).toString("hex")}@test.invalid`;
  const password = `E2e${randomBytes(9).toString("hex")}`;
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "User-Agent": "e2e-setup" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Testeur E2E", consents: { terms: "2026-10", privacy: "2026-10" } },
    }),
  });
  if (!response.ok) throw new Error(`Création du compte de test impossible : HTTP ${response.status} ${await response.text()}`);
  const user = (await response.json()) as { id: string };

  process.env.E2E_USER_ID = user.id;
  process.env.E2E_USER_EMAIL = email;
  process.env.E2E_USER_PASSWORD = password;
}
