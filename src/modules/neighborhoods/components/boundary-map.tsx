"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Périmètre VALIDÉ d'un quartier (GeoJSON) sur fond OpenStreetMap. Chargée
 * uniquement dans le navigateur ; la molette ne zoome pas (défilement préservé).
 */
export function BoundaryMap({ geojson, tileUrl, attribution, label }: { geojson: string; tileUrl: string; attribution: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
      const layer = L.geoJSON(JSON.parse(geojson) as GeoJSON.GeoJsonObject, {
        style: { color: "#0f5c73", weight: 2, fillColor: "#1f7a94", fillOpacity: 0.15 },
      }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding: [16, 16] });
    });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [geojson, tileUrl, attribution]);

  return <div ref={container} role="img" aria-label={label} className="relative z-0 h-72 w-full overflow-hidden rounded-card border border-border sm:h-96" />;
}
