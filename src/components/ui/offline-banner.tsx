"use client";

import { CloudOff } from "lucide-react";
import { useOffline } from "next/offline";

/**
 * Bandeau affiché pendant une perte de connexion. Next.js relance
 * automatiquement les navigations et actions bloquées au retour du réseau
 * (`experimental.useOffline`).
 */
export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-16 z-30 border-b border-yellow-200 bg-warning-soft lg:top-[7.5rem]">
      <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-900 sm:px-6 lg:px-8">
        <CloudOff aria-hidden className="h-4 w-4 shrink-0" />
        Vous êtes hors ligne. Les pages déjà ouvertes restent consultables ; vos actions reprendront au retour de la connexion.
      </p>
    </div>
  );
}
