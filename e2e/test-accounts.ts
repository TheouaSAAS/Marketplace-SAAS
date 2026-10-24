/**
 * Accès d'administration (clé secrète) pour préparer et nettoyer les comptes
 * de test. Le réseau du poste coupe parfois (délais de connexion) : chaque
 * appel est retenté, et les comptes orphelins d'une exécution précédente sont
 * retrouvés à leur adresse caractéristique pour être supprimés.
 */

/** Adresse des comptes créés par les tests : rien d'autre n'est jamais supprimé. */
export const TEST_EMAIL = /^e2e-[0-9a-f]{12}@test\.invalid$/;

export async function adminFetch(url: string, secret: string, path: string, init: RequestInit = {}, attempts = 4): Promise<Response> {
  const headers = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "User-Agent": "e2e-comptes", ...init.headers };
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(`${url}${path}`, { ...init, headers, signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }
}

/**
 * Supprime un compte de test, les demandes qu'il a envoyées (elles survivent au compte, expéditeur effacé)
 * et les organisations qu'il a créées : sinon la base refuse la suppression (une organisation garde
 * toujours son créateur et un propriétaire) et le compte reste orphelin.
 */
export async function deleteTestUser(url: string, secret: string, id: string): Promise<boolean> {
  const requests = await adminFetch(url, secret, `/rest/v1/contact_requests?sender_id=eq.${id}`, { method: "DELETE" });
  if (!requests.ok) console.warn(`Demandes du compte de test ${id} non supprimées : HTTP ${requests.status}`);
  const organizations = await adminFetch(url, secret, `/rest/v1/organizations?created_by=eq.${id}`, { method: "DELETE" });
  if (!organizations.ok) console.warn(`Organisations du compte de test ${id} non supprimées : HTTP ${organizations.status}`);
  const response = await adminFetch(url, secret, `/auth/v1/admin/users/${id}`, { method: "DELETE" });
  if (!response.ok) console.warn(`Compte de test ${id} non supprimé : HTTP ${response.status}`);
  return response.ok;
}

/** Comptes de test laissés par une exécution interrompue (nettoyage manqué). */
export async function deleteOrphanTestUsers(url: string, secret: string): Promise<number> {
  const response = await adminFetch(url, secret, "/auth/v1/admin/users?per_page=1000");
  if (!response.ok) return 0;
  const { users } = (await response.json()) as { users: { id: string; email?: string }[] };
  let deleted = 0;
  for (const user of users.filter((item) => TEST_EMAIL.test(item.email ?? ""))) {
    if (await deleteTestUser(url, secret, user.id)) deleted++;
  }
  return deleted;
}
