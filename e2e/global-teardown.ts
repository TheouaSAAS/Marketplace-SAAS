/** Supprime les comptes de test créés par global-setup (et leurs données, par cascade). */
export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return;
  for (const id of [process.env.E2E_USER_ID, process.env.E2E_USER2_ID]) {
    if (!id) continue;
    const response = await fetch(`${url}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: secret, Authorization: `Bearer ${secret}`, "User-Agent": "e2e-teardown" },
    });
    if (!response.ok) console.warn(`Compte de test ${id} non supprimé : HTTP ${response.status}`);
  }
}
