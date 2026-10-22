import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { adminFetch, deleteOrphanTestUsers } from "./test-accounts";

/**
 * Crée des comptes de test CONFIRMÉS par l'API d'administration (aucun e-mail
 * envoyé), exposés aux tests par variables d'environnement, supprimés dans
 * global-teardown (les orphelins d'une exécution interrompue sont supprimés au
 * démarrage). Trois comptes indépendants : les tests qui tournent en
 * parallèle ne se perturbent pas (E2E_USER_* pour les comptes et parcours,
 * E2E_USER2_* pour la fiche annonce et la messagerie, E2E_ADMIN_* pour
 * l'administration du référentiel). Sans Supabase configuré, les tests de
 * compte sont ignorés.
 */
async function createUser(url: string, secret: string, prefix: "E2E_USER" | "E2E_USER2" | "E2E_ADMIN", displayName: string) {
  const email = `e2e-${randomBytes(6).toString("hex")}@test.invalid`;
  const password = `E2e${randomBytes(9).toString("hex")}`;
  const response = await adminFetch(url, secret, "/auth/v1/admin/users", {
    method: "POST",
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
  const orphans = await deleteOrphanTestUsers(url, secret);
  if (orphans > 0) console.log(`${orphans} compte(s) de test orphelin(s) supprimé(s).`);
  await createUser(url, secret, "E2E_USER", "Testeur E2E");
  await createUser(url, secret, "E2E_USER2", "Testeur E2E bis");
  await createUser(url, secret, "E2E_ADMIN", "Administrateur E2E");
  // Rôle attribué par la clé secrète (contexte système), seul moyen hors superadministrateur.
  const promoted = await adminFetch(url, secret, `/rest/v1/profiles?id=eq.${process.env.E2E_ADMIN_ID}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "admin" }),
  });
  if (!promoted.ok) throw new Error(`Attribution du rôle administrateur impossible : HTTP ${promoted.status} ${await promoted.text()}`);
}
