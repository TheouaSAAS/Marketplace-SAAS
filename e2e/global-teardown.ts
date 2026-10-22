import { deleteTestUser } from "./test-accounts";

/**
 * Supprime les comptes de test créés par global-setup (et leurs données, par
 * cascade ou explicitement). Un échec réseau n'interrompt pas les autres
 * suppressions ; un compte oublié sera supprimé au démarrage suivant.
 */
export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return;
  for (const id of [process.env.E2E_USER_ID, process.env.E2E_USER2_ID, process.env.E2E_ADMIN_ID]) {
    if (!id) continue;
    try {
      await deleteTestUser(url, secret, id);
    } catch (error) {
      console.warn(`Compte de test ${id} non supprimé (réseau) : il le sera au prochain démarrage.`, error);
    }
  }
}
