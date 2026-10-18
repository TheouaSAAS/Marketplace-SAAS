/** Supprime le compte de test créé par global-setup (et ses données, par cascade). */
export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const id = process.env.E2E_USER_ID;
  if (!url || !secret || !id) return;
  const response = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "User-Agent": "e2e-teardown" },
  });
  if (!response.ok) console.warn(`Compte de test ${id} non supprimé : HTTP ${response.status}`);
}
