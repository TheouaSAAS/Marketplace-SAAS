import { MapPin } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { LOCATION_DISPLAY, type PublicLocationPrecision } from "../domain/presentation";
import { ListingMap } from "./listing-map";

/**
 * Localisation selon le choix de l'annonceur : carte d'un point ou d'une
 * zone approximative, ou seulement le quartier, ou rien. La position vient
 * de la base déjà dégradée ; aucune adresse n'est affichée.
 */
export function ListingLocation({
  precision,
  point,
  neighborhood,
  city,
  mapEnabled,
}: {
  precision: PublicLocationPrecision;
  point: { lat: number; lng: number } | null;
  neighborhood: string | null;
  city: string;
  mapEnabled: boolean;
}) {
  const display = LOCATION_DISPLAY[precision];
  const place = [neighborhood, city].filter(Boolean).join(", ");
  return (
    <section aria-labelledby="localisation" className="flex flex-col gap-3">
      <h2 id="localisation" className="text-xl font-bold">
        Localisation
      </h2>
      <p className="flex items-center gap-1.5 font-semibold">
        <MapPin aria-hidden className="h-4 w-4 text-brand-700" />
        {place || city}
      </p>
      <p className="text-sm text-ink-muted">
        <span className="font-semibold">{display.label}.</span> {display.description}
      </p>
      {mapEnabled && point && (
        <ListingMap
          lat={point.lat}
          lng={point.lng}
          radiusMeters={display.radiusMeters}
          tileUrl={publicEnv.NEXT_PUBLIC_MAP_TILE_URL}
          attribution={publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION}
          label={`Carte : ${display.label.toLowerCase()}, ${place || city}`}
        />
      )}
    </section>
  );
}
