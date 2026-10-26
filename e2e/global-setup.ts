import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { totp } from "./sign-in";
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
  await enrollSecondFactor(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}

/**
 * Second facteur de l'administrateur de test : configuré par l'API publique
 * d'authentification, exactement comme le ferait l'application (inscription
 * du facteur TOTP, puis premier code vérifié). La clé est exposée aux tests.
 */
async function enrollSecondFactor(url: string, publishableKey: string) {
  const call = async (path: string, body: unknown, token?: string) => {
    const response = await fetch(`${url}/auth/v1${path}`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Second facteur de test : HTTP ${response.status} sur ${path} — ${await response.text()}`);
    return response.json();
  };
  const session = await call("/token?grant_type=password", { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD });
  const factor = await call("/factors", { factor_type: "totp", friendly_name: "e2e" }, session.access_token);
  const challenge = await call(`/factors/${factor.id}/challenge`, {}, session.access_token);
  await call(`/factors/${factor.id}/verify`, { challenge_id: challenge.id, code: totp(factor.totp.secret) }, session.access_token);
  process.env.E2E_ADMIN_TOTP_SECRET = factor.totp.secret;
}
