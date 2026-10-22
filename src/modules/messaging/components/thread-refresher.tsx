"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge le fil toutes les `seconds` secondes, seulement quand l'onglet est visible. */
export function ThreadRefresher({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return null;
}
