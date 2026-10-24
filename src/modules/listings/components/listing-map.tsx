"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Carte OpenStreetMap (Leaflet) de la position PUBLIQUE d'une annonce :
 * un point si l'annonceur a choisi l'emplacement précis, sinon un cercle
 * autour d'une position déjà arrondie par la base. Chargée uniquement dans le
 * navigateur ; la molette ne zoome pas (défilement de la page préservé).
 */
export function ListingMap({
  lat,
  lng,
  radiusMeters,
  tileUrl,
  attribution,
  label,
}: {
  lat: number;
  lng: number;
  radiusMeters: number | null;
  tileUrl: string;
  attribution: string;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false, attributionControl: true }).setView([lat, lng], radiusMeters ? 15 : 16);
      L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
      const style = { color: "#0f5c73", weight: 2, fillColor: "#1f7a94", fillOpacity: 0.2 };
      if (radiusMeters) L.circle([lat, lng], { ...style, radius: radiusMeters }).addTo(map);
      else L.circleMarker([lat, lng], { ...style, radius: 9, fillOpacity: 0.8 }).addTo(map);
    });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [lat, lng, radiusMeters, tileUrl, attribution]);

  // Une figure légendée plutôt qu'une « image » : la carte contient des contrôles (zoom, attribution).
  return (
    <figure className="m-0">
      <div ref={container} className="relative z-0 h-64 w-full overflow-hidden rounded-card border border-border sm:h-80" />
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
