/*
 * Service worker minimal de Carrefour des Possibles.
 *
 * Seul rôle : afficher la page « Hors ligne » quand une navigation échoue faute
 * de réseau. Il ne met en cache AUCUNE autre ressource : pas de risque de
 * servir un contenu périmé (annonce retirée, prix modifié…).
 * Changer CACHE_VERSION pour forcer la mise à jour de la page mise en cache.
 */
const CACHE_VERSION = "cdp-hors-ligne-v1";
const OFFLINE_URL = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      return cached ?? new Response("Vous êtes hors ligne.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }),
  );
});
