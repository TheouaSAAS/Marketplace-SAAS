"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { watchTopic } from "@/lib/supabase/realtime";
import { nextRefreshDelay } from "../domain/live";

type Mode = "connecting" | "live" | "polling";

const LABELS: Record<Mode, string> = {
  connecting: "Mise à jour automatique",
  live: "Mise à jour en direct",
  polling: "Mise à jour automatique chaque minute",
};

/**
 * Tient une liste (ou une fiche, avec `listingId`) à jour sans recharger la
 * page : la base signale chaque changement d'une annonce publique sur le canal
 * « annonces », la page se recharge alors côté serveur (droits et modération
 * appliqués comme au premier affichage, liste remplacée : aucun doublon).
 * Sans temps réel (réseau, service coupé), rechargement chaque minute ; après
 * une reconnexion ou un retour sur l'onglet, un rechargement rattrape les
 * changements manqués.
 */
export function LiveListings({ listingId, enabled = true, pollSeconds = 60 }: { listingId?: string; enabled?: boolean; pollSeconds?: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("connecting");

  useEffect(() => {
    let last = Date.now();
    let timer: number | undefined;
    let live = false;
    let wasLive = false;
    let missed = false;

    const refresh = () => {
      if (document.visibilityState !== "visible") {
        missed = true;
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        last = Date.now();
        missed = false;
        router.refresh();
      }, nextRefreshDelay(last, Date.now()));
    };

    let unwatch: (() => void) | undefined;
    const start = () => {
      // Temps réel coupé (drapeau live_updates) : rechargement périodique seul.
      if (!enabled) return setMode("polling");
      unwatch = watchTopic("annonces", "annonce", {
        onMessage: (payload) => {
          if (!listingId || (payload as { id?: unknown } | undefined)?.id === listingId) refresh();
        },
        onStatus: (status) => {
          if (status === "SUBSCRIBED") {
            // Reconnexion : des changements ont pu passer pendant la coupure.
            if (wasLive) refresh();
            live = wasLive = true;
            setMode("live");
          } else if (status !== "CONNECTING") {
            live = false;
            setMode("polling");
          }
        },
      });
    };
    // Connexion après l'affichage complet : le temps réel ne retarde pas la page.
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    const poll = window.setInterval(() => {
      if (!live) refresh();
    }, pollSeconds * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && missed) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("load", start);
      unwatch?.();
    };
  }, [router, listingId, enabled, pollSeconds]);

  return (
    <p className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted sm:w-64 sm:justify-end" data-live={mode}>
      <span aria-hidden className={mode === "live" ? "h-2 w-2 rounded-full bg-success" : "h-2 w-2 rounded-full bg-border-strong"} />
      {LABELS[mode]}
    </p>
  );
}
