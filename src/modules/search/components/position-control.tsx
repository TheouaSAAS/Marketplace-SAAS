"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LocateFixed, LocateOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPositionCookie, POSITION_COOKIE, POSITION_MAX_AGE_SECONDS } from "../domain/position";

type Status = "idle" | "pending" | "denied" | "unavailable";

const MESSAGES: Record<Exclude<Status, "idle" | "pending">, string> = {
  denied: "Position refusée : la recherche fonctionne sans, mais le tri et le filtre par distance restent désactivés.",
  unavailable: "Position indisponible sur cet appareil pour le moment. Réessayez ou choisissez un quartier.",
};

function writeCookie(value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${POSITION_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

/**
 * « Autour de moi » : la position n'est demandée qu'au clic, arrondie à
 * ~100 m, gardée 30 minutes dans ce navigateur et jamais placée dans
 * l'adresse de la recherche.
 */
export function PositionControl({ hasPosition }: { hasPosition: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [refreshing, startRefresh] = useTransition();

  const refresh = () => startRefresh(() => router.refresh());

  const request = () => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        writeCookie(formatPositionCookie({ lat: coords.latitude, lng: coords.longitude }), POSITION_MAX_AGE_SECONDS);
        setStatus("idle");
        refresh();
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  const forget = () => {
    writeCookie("", 0);
    refresh();
  };

  if (hasPosition) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">Position utilisée (arrondie à environ 100 m, non enregistrée).</p>
        <Button type="button" variant="ghost" onClick={forget} loading={refreshing} icon={<LocateOff aria-hidden className="h-4 w-4" />}>
          Ne plus utiliser ma position
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        onClick={request}
        loading={status === "pending" || refreshing}
        icon={<LocateFixed aria-hidden className="h-4 w-4" />}
      >
        Utiliser ma position
      </Button>
      {status === "denied" || status === "unavailable" ? (
        <p role="status" className="text-sm text-ink-muted">
          {MESSAGES[status]}
        </p>
      ) : (
        <p className="text-xs text-ink-subtle">Demandée seulement maintenant, jamais enregistrée ni partagée.</p>
      )}
    </div>
  );
}
