"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (page « Hors ligne ») en production uniquement :
 * en développement, il gênerait le rechargement à chaud.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Échec sans conséquence : le site fonctionne normalement sans service worker.
    });
  }, []);
  return null;
}
